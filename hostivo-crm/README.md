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
   collez l'ID du Sheet et le gid de l'onglet, tous deux visibles dans
   l'URL :

   ```
   https://docs.google.com/spreadsheets/d/CET_ID_LA/edit?gid=CE_GID_LA#gid=CE_GID_LA
   ```

   ```
   VITE_GOOGLE_SHEET_ID="CET_ID_LA"
   VITE_GOOGLE_SHEET_GID="CE_GID_LA"   # cible l'onglet sans dépendre de son nom
   VITE_GOOGLE_SHEET_NAME=""            # alternative si vous préférez cibler par nom
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

## Modifier les clients depuis l'app

Par défaut l'app est en **lecture seule**. Pour qu'Anis, Jules et les autres
collaborateurs puissent changer le statut du site, le statut de modification
ou les notes directement depuis la fiche client (sans ouvrir le Sheet), il
faut déployer un petit point d'écriture — l'app est un frontend statique
sans serveur, donc l'écriture passe par un script côté Google Sheets plutôt
que par une API tierce :

1. Dans le Google Sheet, **Extensions → Apps Script**.
2. Collez le contenu de [`apps-script/Code.gs`](apps-script/Code.gs) à la
   place du code par défaut.
3. **Project Settings** (⚙️) → **Script Properties** → ajoutez
   `WRITE_SECRET` avec une valeur secrète de votre choix (une phrase
   aléatoire suffit, ex. `hostivo-2026-xyz`).
4. **Déployer → Nouveau déploiement → Application Web**.
   - *Exécuter en tant que* : Moi
   - *Qui a accès* : Tout le monde
5. Copiez l'URL du déploiement (se termine par `/exec`) et complétez
   `.env.local` :

   ```
   VITE_SHEET_WRITE_URL="https://script.google.com/macros/s/AKfycb.../exec"
   VITE_SHEET_WRITE_SECRET="hostivo-2026-xyz"   # même valeur que WRITE_SECRET
   ```

Redémarrez `npm run dev`. Une fois ces variables renseignées :

- la fiche client affiche des champs modifiables (statut du site, statut de
  modification, notes) avec un bouton **Enregistrer** qui écrit directement
  dans la bonne ligne du Sheet — le script revérifie le nom de l'entreprise
  avant d'écrire, pour éviter d'altérer la mauvaise ligne si le Sheet a été
  trié entre-temps ;
- un bouton **+ Nouveau client** apparaît au-dessus du tableau : il ouvre un
  formulaire (nom, téléphone, secteur, date de la demande, réseaux
  souhaités, statut, notes) et ajoute une nouvelle ligne en bas du Sheet dès
  la validation, avec son numéro attribué automatiquement.

Cette clé secrète est visible dans le code source envoyé au navigateur : elle
empêche les écritures accidentelles ou aléatoires, mais ne remplace pas une
authentification par utilisateur. Suffisant pour un outil interne à
quelques collaborateurs de confiance ; à éviter si le lien de l'app venait à
être partagé publiquement.

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
- **Édition et ajout de clients** (optionnels, voir ci-dessus) : changer le
  statut du site, le statut de modification et les notes depuis la fiche
  client, ou ajouter un nouveau client via un formulaire dédié — écriture
  directe dans le Sheet dans les deux cas.

## Déploiement sur Vercel

Le dépôt contient `vercel.json` (build Vite standard). Étapes :

1. Sur [vercel.com](https://vercel.com), **Add New → Project**, importer ce
   dépôt GitHub (`maison-zeynaa`).
2. **Root Directory** : comme ce projet vit dans un sous-dossier du dépôt,
   réglez-le sur `hostivo-crm` (bouton *Edit* à côté de "Root Directory"
   pendant la configuration).
3. Le framework Vite est détecté automatiquement à partir de `vercel.json`.
4. Dans **Settings → Environment Variables**, ajoutez :
   - `VITE_GOOGLE_SHEET_ID` et `VITE_GOOGLE_SHEET_NAME` (lecture du Sheet)
   - `VITE_SHEET_WRITE_URL` et `VITE_SHEET_WRITE_SECRET` (si l'édition est
     activée — voir la section précédente)
   - `BASIC_AUTH_USER` et `BASIC_AUTH_PASSWORD` (pour sécuriser le lien —
     voir ci-dessous)
5. **Deploy**.

Je n'ai pas d'accès direct à un compte Vercel depuis cette session pour
lancer le déploiement à votre place — ces étapes prennent normalement 2
minutes depuis le dashboard Vercel.

## Sécuriser le lien

Comme le CRM affiche des données clients réelles (téléphones, notes), le
projet inclut `middleware.ts` : une authentification HTTP Basic exécutée par
Vercel Edge Middleware, qui protège **toute** l'app derrière un couple
identifiant / mot de passe, avant même de servir la moindre page. Gratuit,
aucun plan Vercel payant requis.

Pour l'activer, définissez dans **Settings → Environment Variables** du
projet Vercel :

```
BASIC_AUTH_USER="anis"
BASIC_AUTH_PASSWORD="choisissez-un-mot-de-passe-solide"
```

Sans ces deux variables, le site reste accessible sans mot de passe (pratique
en local). Une fois définies puis redéployé, chaque visiteur devra saisir
ces identifiants avant d'accéder à quoi que ce soit — y compris les assets
statiques.

Pour partager l'accès avec toute l'équipe (Anis, Jules…), communiquez-leur
simplement ces identifiants ; changez le mot de passe à tout moment en
modifiant la variable d'environnement et en redéployant.

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
