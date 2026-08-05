# Hostivo CRM — Suivi Clients

Interface de suivi des ~80 clients Hostivo (demande, secteur, réseaux sociaux,
statut du site, dates, notes) branchée sur le Google Sheet existant.

## Lancer en local

```bash
npm install
npm run dev      # http://localhost:3001
```

```bash
npm run build    # construit dans dist/
npm run preview  # sert le build de production
npm run lint      # vérification TypeScript
```

Sans configuration, l'app affiche un jeu de données de démonstration (extrait
du récapitulatif PDF) — pratique pour visualiser l'interface sans toucher au
vrai Sheet.

## Connecter le vrai Google Sheet

L'app lit le Sheet directement depuis le navigateur, sans backend ni clé API,
via l'export JSON public de Google Sheets. Deux étapes :

1. **Partager le Sheet en lecture publique** : dans Google Sheets,
   *Partager* → *Toute personne disposant du lien* → rôle *Lecteur*. (Rien
   n'est modifiable depuis l'extérieur avec ce réglage — c'est une lecture
   seule.)
2. **Renseigner l'identifiant** : copiez `.env.example` vers `.env.local` et
   collez l'ID du Sheet, visible dans son URL :

   ```
   https://docs.google.com/spreadsheets/d/CET_ID_LA/edit
   ```

   ```
   VITE_GOOGLE_SHEET_ID="CET_ID_LA"
   VITE_GOOGLE_SHEET_NAME=""   # nom de l'onglet, vide = premier onglet
   ```

Redémarrez `npm run dev`. L'app lit désormais les colonnes du Sheet par leur
**intitulé** (peu importe leur ordre exact ou l'ajout de colonnes) :

| Colonne attendue (intitulé contient…)     | Champ                          |
| ------------------------------------------ | ------------------------------ |
| `date` + `demande`                         | Date de la demande              |
| `entreprise`                                | Nom de l'entreprise              |
| `téléphone` / `telephone`                   | Téléphone                        |
| `secteur`                                   | Secteur d'activité               |
| `réseaux` + `souhait`                       | Réseaux sociaux souhaités        |
| `réseaux` (seul)                            | Cellule combinée souhaités+liens |
| `lien`                                      | Liens (Instagram, TikTok, …)     |
| `compte` + `démarch`                        | Compte démarché                  |
| `statut` + `modif`                          | Statut de modification           |
| `statut` (seul)                             | Statut du site                   |
| `dernière` + `mise`                         | Dernière mise à jour             |
| `mise en ligne`                             | Date de mise en ligne            |
| `note` + `modif`                            | Note de modification             |
| `note` (seul)                               | Notes                            |
| `date` + `modif`                            | Date de modification             |

Si une entreprise n'apparaît pas, vérifiez que la ligne a bien un nom en
colonne « Nom entreprise » — les lignes vides sont ignorées.

## Fonctionnalités

- **Tableau** triable (numéro, entreprise, secteur, statut, date de mise en
  ligne) avec recherche libre et filtres par secteur / statut du site /
  statut de modification.
- **Statuts colorés** : Mis en ligne (vert), Maquette envoyée (ambre), En
  attente client (gris), Refus (rouge), Site en cours (bleu) — cliquables
  depuis les tuiles de statistiques en haut de page pour filtrer d'un coup.
- **Accès rapide aux réseaux sociaux** : icônes cliquables (Instagram,
  TikTok, Facebook, LinkedIn, YouTube) directement dans le tableau et dans
  la fiche détail, plus boutons **Appeler** et **WhatsApp** générés depuis le
  numéro de téléphone.
- **Fiche client** (panneau latéral) : toutes les colonnes du Sheet, notes et
  historique de modification.

## Déploiement

Projet Vite/React statique, déployable comme n'importe quelle app front (
Vercel, Netlify…). Pensez à renseigner `VITE_GOOGLE_SHEET_ID` (et
`VITE_GOOGLE_SHEET_NAME` si besoin) dans les variables d'environnement du
service d'hébergement.

## Structure

```
src/
  components/   TopBar, StatsBar, Filters, ClientTable, ClientDetail, …
  lib/
    sheets.ts   lecture du Google Sheet (export JSON public) + mapping des colonnes
    parse.ts    parsing dates, réseaux sociaux et liens
    phone.ts    liens tel: / wa.me à partir du numéro
  data/
    sampleData.ts   données de démonstration (hors ligne)
  types.ts      modèle de données Client
```
