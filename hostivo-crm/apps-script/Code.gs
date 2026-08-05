/**
 * Point d'écriture pour Hostivo CRM.
 *
 * Installation :
 * 1. Dans le Google Sheet, menu Extensions → Apps Script.
 * 2. Collez ce fichier à la place du contenu par défaut (Code.gs).
 * 3. Project Settings (icône ⚙️) → Script Properties → ajoutez une
 *    propriété WRITE_SECRET avec une valeur secrète de votre choix
 *    (une phrase aléatoire suffit).
 * 4. Déployer → Nouveau déploiement → type "Application Web".
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde (obligatoire pour que l'app web y accède)
 * 5. Copiez l'URL du déploiement (se termine par /exec) dans
 *    VITE_SHEET_WRITE_URL côté app, et la même valeur que WRITE_SECRET
 *    dans VITE_SHEET_WRITE_SECRET.
 *
 * Deux opérations, distinguées par data.action :
 * - "update" (par défaut) : modifie statut du site / statut de modification /
 *   notes / note de modification sur une ligne existante (identifiée par son
 *   numéro de ligne + vérification du nom d'entreprise, pour éviter d'altérer
 *   la mauvaise ligne si le Sheet a été trié entre-temps).
 * - "create" : ajoute une nouvelle ligne cliente en bas du Sheet.
 * Dans les deux cas, seules les colonnes correspondant aux champs envoyés
 * sont touchées — le reste de la ligne/du Sheet n'est jamais modifié.
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
    var sheet = data.sheetName ? ss.getSheetByName(data.sheetName) : ss.getSheets()[0];
    if (!sheet) return jsonResponse_({ ok: false, error: 'Feuille introuvable.' });

    if (data.action === 'create') return handleCreate_(sheet, data);
    return handleUpdate_(sheet, data);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
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
