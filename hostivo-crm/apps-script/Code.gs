/**
 * Point d'écriture + authentification pour Hostivo CRM.
 *
 * Installation :
 * 1. Dans le Google Sheet, menu Extensions → Apps Script.
 * 2. Collez ce fichier à la place du contenu par défaut (Code.gs).
 * 3. Project Settings (icône ⚙️) → Script Properties → ajoutez :
 *    - WRITE_SECRET : une phrase secrète de votre choix (protège l'accès à
 *      ce point d'entrée depuis l'app).
 *    - AUTH_SECRET : une AUTRE phrase secrète, aléatoire, dédiée à la
 *      signature des sessions de connexion (ne la réutilisez pas ailleurs).
 * 4. Déployer → Nouveau déploiement → type "Application Web".
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde (obligatoire pour que l'app web y accède)
 * 5. Copiez l'URL du déploiement (se termine par /exec) dans
 *    VITE_SHEET_WRITE_URL côté app, et la même valeur que WRITE_SECRET
 *    dans VITE_SHEET_WRITE_SECRET.
 * 6. Dans l'éditeur Apps Script, sélectionnez la fonction `initUsers_` dans
 *    le menu déroulant puis cliquez ▶ Exécuter, **une seule fois**, pour
 *    créer les 3 comptes (Jules, Anis, Reda). Les mots de passe initiaux
 *    sont dans le corps de `initUsers_` — communiquez-les puis ne les
 *    laissez pas traîner : ils ne sont de toute façon jamais stockés en
 *    clair, seul leur hash l'est, et chaque compte doit en changer à la
 *    première connexion.
 *
 * Opérations, distinguées par data.action :
 * - "update" (par défaut) : modifie statut du site / statut de modification /
 *   notes / note de modification sur une ligne existante (identifiée par son
 *   numéro de ligne + vérification du nom d'entreprise, pour éviter d'altérer
 *   la mauvaise ligne si le Sheet a été trié entre-temps).
 * - "create" : ajoute une nouvelle ligne cliente en bas du Sheet.
 * - "login" / "verifySession" / "changePassword" : authentification (voir
 *   plus bas). Indépendante du reste : ces trois actions ne touchent jamais
 *   aux données clientes, seulement à la propriété de script USERS_V1.
 * Dans tous les cas, seules les colonnes/propriétés correspondant aux champs
 * envoyés sont touchées.
 */

var UPDATE_FIELDS = {
  statutSite: function (h) { return h.indexOf('statut') !== -1 && h.indexOf('modif') === -1; },
  statutModification: function (h) { return h.indexOf('statut') !== -1 && h.indexOf('modif') !== -1; },
  notes: function (h) { return h.indexOf('note') !== -1 && h.indexOf('modif') === -1; },
  noteModification: function (h) { return h.indexOf('note') !== -1 && h.indexOf('modif') !== -1; },
};

var CREATE_FIELDS = {
  dateDemande: function (h) { return h.indexOf('date') !== -1 && h.indexOf('demande') !== -1; },
  nomEntreprise: function (h) { return h.indexOf('entreprise') !== -1; },
  telephone: function (h) { return h.indexOf('telephone') !== -1 || h === 'tel'; },
  secteur: function (h) { return h.indexOf('secteur') !== -1; },
  reseauxSouhaitesSeparate: function (h) { return h.indexOf('reseau') !== -1 && h.indexOf('souhait') !== -1; },
  reseauxCombined: function (h) { return h.indexOf('reseau') !== -1 && h.indexOf('souhait') === -1; },
  statutSite: function (h) { return h.indexOf('statut') !== -1 && h.indexOf('modif') === -1; },
  notes: function (h) { return h.indexOf('note') !== -1 && h.indexOf('modif') === -1; },
};

function normalizeHeader_(label) {
  return String(label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function findColumn_(headers, matcher) {
  for (var i = 0; i < headers.length; i++) {
    if (matcher(normalizeHeader_(headers[i]))) return i + 1; // colonnes 1-indexées
  }
  return -1;
}

function findNomEntrepriseColumn_(headers) {
  for (var i = 0; i < headers.length; i++) {
    if (normalizeHeader_(headers[i]).indexOf('entreprise') !== -1) return i + 1;
  }
  return -1;
}

function findNumeroColumn_(headers) {
  for (var i = 0; i < headers.length; i++) {
    var h = normalizeHeader_(headers[i]);
    if (h === '#' || h === 'numero' || h === 'num' || h.indexOf('n°') === 0) return i + 1;
  }
  return -1;
}

function findSheet_(ss, data) {
  if (data.sheetGid !== undefined && data.sheetGid !== null && data.sheetGid !== '') {
    var gid = Number(data.sheetGid);
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === gid) return sheets[i];
    }
  }
  if (data.sheetName) return ss.getSheetByName(data.sheetName);
  return ss.getSheets()[0];
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse_({ ok: true, message: 'Hostivo CRM write endpoint is running.' });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var expectedSecret = PropertiesService.getScriptProperties().getProperty('WRITE_SECRET');
    if (!expectedSecret || data.secret !== expectedSecret) {
      return jsonResponse_({ ok: false, error: 'Non autorisé.' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = findSheet_(ss, data);
    if (!sheet) return jsonResponse_({ ok: false, error: 'Feuille introuvable.' });

    if (data.action === 'login') return handleLogin_(data);
    if (data.action === 'verifySession') return handleVerifySession_(data);
    if (data.action === 'changePassword') return handleChangePassword_(data);
    if (data.action === 'create') return handleCreate_(sheet, data);
    return handleUpdate_(sheet, data);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

var USERS_PROPERTY_KEY = 'USERS_V1';
var PASSWORD_MIN_LENGTH = 8;
var TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function getUsers_() {
  var raw = PropertiesService.getScriptProperties().getProperty(USERS_PROPERTY_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveUsers_(users) {
  PropertiesService.getScriptProperties().setProperty(USERS_PROPERTY_KEY, JSON.stringify(users));
}

function bytesToHex_(bytes) {
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    })
    .join('');
}

function sha256Hex_(text) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}

function hashPassword_(password, salt) {
  return sha256Hex_(salt + ':' + password);
}

function randomSalt_() {
  return Utilities.getUuid();
}

function getAuthSecret_() {
  var s = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
  if (!s) throw new Error("AUTH_SECRET manquant dans les Script Properties — voir le commentaire d'installation en haut du fichier.");
  return s;
}

function base64UrlEncode_(str) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(str).getBytes()).replace(/=+$/, '');
}

function base64UrlDecode_(str) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(str)).getDataAsString();
}

/** Jeton de session signé (HMAC), sans état côté serveur — pas de limite de durée de CacheService. */
function signToken_(payload) {
  var body = base64UrlEncode_(JSON.stringify(payload));
  var sig = bytesToHex_(Utilities.computeHmacSha256Signature(body, getAuthSecret_()));
  return body + '.' + sig;
}

function verifyToken_(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
  var dot = token.indexOf('.');
  var body = token.slice(0, dot);
  var sig = token.slice(dot + 1);
  var expectedSig = bytesToHex_(Utilities.computeHmacSha256Signature(body, getAuthSecret_()));
  if (expectedSig !== sig) return null;
  var payload;
  try {
    payload = JSON.parse(base64UrlDecode_(body));
  } catch (e) {
    return null;
  }
  if (!payload || !payload.exp || Date.now() > payload.exp) return null;
  return payload; // { u: <username>, exp: <epoch ms> }
}

function passwordMeetsPolicy_(pw) {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN_LENGTH) return false;
  if (!/[A-Z]/.test(pw)) return false;
  if (!/[0-9]/.test(pw)) return false;
  if (!/[^A-Za-z0-9]/.test(pw)) return false;
  return true;
}

function handleLogin_(data) {
  var username = String(data.username || '').trim().toLowerCase();
  var password = String(data.password || '').trim();
  var users = getUsers_();
  var user = users[username];
  if (!user || hashPassword_(password, user.salt) !== user.hash) {
    return jsonResponse_({ ok: false, error: 'Identifiants incorrects.' });
  }

  var token = signToken_({ u: username, exp: Date.now() + TOKEN_LIFETIME_MS });
  return jsonResponse_({
    ok: true,
    token: token,
    username: username,
    displayName: user.displayName || username,
    mustChangePassword: !!user.mustChange,
  });
}

function handleVerifySession_(data) {
  var payload = verifyToken_(data.token);
  if (!payload) return jsonResponse_({ ok: false, error: 'Session expirée.' });
  var users = getUsers_();
  var user = users[payload.u];
  if (!user) return jsonResponse_({ ok: false, error: 'Compte introuvable.' });
  return jsonResponse_({
    ok: true,
    username: payload.u,
    displayName: user.displayName || payload.u,
    mustChangePassword: !!user.mustChange,
  });
}

function handleChangePassword_(data) {
  var payload = verifyToken_(data.token);
  if (!payload) return jsonResponse_({ ok: false, error: 'Session expirée, reconnectez-vous.' });
  var users = getUsers_();
  var user = users[payload.u];
  if (!user) return jsonResponse_({ ok: false, error: 'Compte introuvable.' });

  var currentPassword = String(data.currentPassword || '').trim();
  if (hashPassword_(currentPassword, user.salt) !== user.hash) {
    return jsonResponse_({ ok: false, error: 'Mot de passe actuel incorrect.' });
  }

  var newPassword = String(data.newPassword || '').trim();
  if (!passwordMeetsPolicy_(newPassword)) {
    return jsonResponse_({
      ok: false,
      error:
        'Le nouveau mot de passe doit contenir au moins ' +
        PASSWORD_MIN_LENGTH +
        ' caractères, une majuscule, un chiffre et un caractère spécial.',
    });
  }

  var newSalt = randomSalt_();
  user.salt = newSalt;
  user.hash = hashPassword_(newPassword, newSalt);
  user.mustChange = false;
  users[payload.u] = user;
  saveUsers_(users);

  var token = signToken_({ u: payload.u, exp: Date.now() + TOKEN_LIFETIME_MS });
  return jsonResponse_({ ok: true, token: token });
}

/**
 * À exécuter UNE SEULE FOIS depuis l'éditeur Apps Script (sélectionner
 * "initUsers_" dans le menu déroulant puis ▶ Exécuter) pour créer les 3
 * comptes ci-dessous. Ré-exécuter écrase les comptes existants — ne le
 * refaites pas une fois que Jules/Anis/Reda ont choisi leur propre mot de
 * passe, sous peine de les réinitialiser.
 */
function initUsers_() {
  var seed = {
    jules: { displayName: 'Jules', password: 'R%#K4y7Sb9R_abcp' },
    anis: { displayName: 'Anis', password: '-%7GByRHy+nT9Lu*' },
    reda: { displayName: 'Reda', password: '7BHMQA=@GT%@y*q9' },
  };
  var users = {};
  for (var username in seed) {
    var salt = randomSalt_();
    users[username] = {
      displayName: seed[username].displayName,
      salt: salt,
      hash: hashPassword_(seed[username].password, salt),
      mustChange: true,
    };
  }
  saveUsers_(users);
  Logger.log('Comptes initialisés : ' + Object.keys(users).join(', '));
}

function handleUpdate_(sheet, data) {
  var rowNumber = Number(data.rowNumber);
  if (!rowNumber || rowNumber < 2) return jsonResponse_({ ok: false, error: 'Numéro de ligne invalide.' });

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var nomCol = findNomEntrepriseColumn_(headers);
  if (nomCol !== -1) {
    var actualNom = String(sheet.getRange(rowNumber, nomCol).getValue() || '').trim();
    var expectedNom = String(data.nomEntreprise || '').trim();
    if (actualNom !== expectedNom) {
      return jsonResponse_({
        ok: false,
        error: 'La ligne ' + rowNumber + ' ne correspond plus à "' + expectedNom + '" (trouvé "' + actualNom + '"). Rechargez la page puis réessayez.',
      });
    }
  }

  var updates = data.updates || {};
  var written = [];
  for (var key in UPDATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;
    var value = updates[key];
    if (value === undefined) continue;
    var col = findColumn_(headers, UPDATE_FIELDS[key]);
    if (col === -1) continue;
    sheet.getRange(rowNumber, col).setValue(value);
    written.push(key);
  }

  return jsonResponse_({ ok: true, written: written });
}

function handleCreate_(sheet, data) {
  var fields = data.fields || {};
  var nomEntreprise = String(fields.nomEntreprise || '').trim();
  if (!nomEntreprise) return jsonResponse_({ ok: false, error: "Le nom de l'entreprise est obligatoire." });

  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var newRow = sheet.getLastRow() + 1;
  if (newRow < 2) newRow = 2; // feuille avec seulement l'en-tête

  var numeroCol = findNumeroColumn_(headers);
  var numero = null;
  if (numeroCol !== -1) {
    var existing = sheet.getRange(2, numeroCol, Math.max(newRow - 2, 1), 1).getValues();
    var maxNumero = 0;
    for (var r = 0; r < existing.length; r++) {
      var n = Number(existing[r][0]);
      if (!isNaN(n) && n > maxNumero) maxNumero = n;
    }
    numero = maxNumero + 1;
    sheet.getRange(newRow, numeroCol).setValue(numero);
  }

  var souhaitesCol = findColumn_(headers, CREATE_FIELDS.reseauxSouhaitesSeparate);
  var combinedCol = findColumn_(headers, CREATE_FIELDS.reseauxCombined);
  var souhaitesList = fields.reseauxSouhaites; // tableau de chaînes envoyé par l'app

  var written = [];
  var simpleFields = ['dateDemande', 'nomEntreprise', 'telephone', 'secteur', 'statutSite', 'notes'];
  for (var i = 0; i < simpleFields.length; i++) {
    var key = simpleFields[i];
    var value = fields[key];
    if (value === undefined || value === null || value === '') continue;
    var col = findColumn_(headers, CREATE_FIELDS[key]);
    if (col === -1) continue;
    sheet.getRange(newRow, col).setValue(value);
    written.push(key);
  }

  if (souhaitesList && souhaitesList.length) {
    var joined = souhaitesList.join(', ');
    if (souhaitesCol !== -1) {
      sheet.getRange(newRow, souhaitesCol).setValue(joined);
      written.push('reseauxSouhaites');
    } else if (combinedCol !== -1) {
      sheet.getRange(newRow, combinedCol).setValue('Souhaités : ' + joined);
      written.push('reseauxSouhaites');
    }
  }

  return jsonResponse_({ ok: true, rowNumber: newRow, numero: numero, written: written });
}
