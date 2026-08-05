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
 * Ce script ne touche qu'aux colonnes explicitement envoyées par l'app
 * (statut du site, statut de modification, notes, note de modification)
 * et vérifie le nom d'entreprise avant d'écrire, pour éviter d'altérer
 * la mauvaise ligne si le Sheet a été trié entre-temps.
 */

var WRITABLE_FIELDS = {
  statutSite: function (h) { return h.indexOf('statut') !== -1 && h.indexOf('modif') === -1; },
  statutModification: function (h) { return h.indexOf('statut') !== -1 && h.indexOf('modif') !== -1; },
  notes: function (h) { return h.indexOf('note') !== -1 && h.indexOf('modif') === -1; },
  noteModification: function (h) { return h.indexOf('note') !== -1 && h.indexOf('modif') !== -1; },
};

function normalizeHeader_(label) {
  return String(label || '').toLowerCase().trim();
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
    if (!sheet) return jsonResponse_({ ok: false, error: "Feuille introuvable." });

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
    for (var key in WRITABLE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;
      var value = updates[key];
      if (value === undefined) continue;
      var col = findColumn_(headers, WRITABLE_FIELDS[key]);
      if (col === -1) continue;
      sheet.getRange(rowNumber, col).setValue(value);
      written.push(key);
    }

    return jsonResponse_({ ok: true, written: written });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}
