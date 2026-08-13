# Hostivo CRM — Suivi Clients

Interface de suivi des ~80 clients Hostivo (demande, secteur, réseaux sociaux,
statut du site, dates, notes) branchée sur une base **Supabase** (Postgres +
authentification).

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
du récapitulatif PDF) — pratique pour visualiser l'interface sans toucher à
la vraie base.

## Connecter Supabase

1. Copiez `.env.example` vers `.env.local` et renseignez l'URL et la clé
   publique (anon) du projet Supabase, visibles dans **Project Settings →
   API** :

   ```
   VITE_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
   VITE_SUPABASE_ANON_KEY="sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx"
   ```

2. Redémarrez `npm run dev`.

Les clients sont stockés dans la table `public.hostivo_clients`, protégée par
des règles RLS (Row Level Security) qui n'autorisent la lecture et
l'écriture qu'aux utilisateurs connectés (`authenticated`) — personne ne peut
lire ou modifier les données sans être identifié, contrairement à l'ancien
Google Sheet en lecture publique.

## Connexion (comptes Jules / Anis / Reda)

L'app n'affiche jamais le tableau sans connexion : trois comptes nominatifs
sont prévus, gérés par **Supabase Auth**.

**Mise en place, une seule fois**, depuis le [dashboard Supabase](https://supabase.com/dashboard)
du projet → **Authentication → Users → Add user** :

| Compte | Email à saisir | Mot de passe temporaire |
| --- | --- | --- |
| `jules` | `jules@hostivo-crm.local` | `R%#K4y7Sb9R_abcp` |
| `anis` | `anis@hostivo-crm.local` | `-%7GByRHy+nT9Lu*` |
| `reda` | `reda@hostivo-crm.local` | `7BHMQA=@GT%@y*q9` |

Pour chacun des 3 comptes :

1. **Add user → Create new user**.
2. Email : copiez exactement l'adresse `@hostivo-crm.local` ci-dessus (ce
   sont des identifiants internes, aucun mail n'est réellement envoyé à ces
   adresses).
3. Password : le mot de passe temporaire correspondant ci-dessus.
4. Cochez **Auto Confirm User** (sinon Supabase attend une confirmation par
   email qui ne peut pas arriver, l'adresse étant fictive).
5. Créez.

Le profil applicatif (nom affiché, obligation de changer le mot de passe)
est créé automatiquement en base à la toute première connexion de chaque
personne — rien d'autre à faire manuellement.

Communiquez à chacun son identifiant (`jules`, `anis` ou `reda` — sélectionné
depuis une liste déroulante sur l'écran de connexion) et son mot de passe
temporaire. À la première connexion, l'app impose de le remplacer par un mot
de passe personnel respectant : **8 caractères minimum, une majuscule, un
chiffre, un caractère spécial**.

Chaque personne peut aussi changer son mot de passe à tout moment via le
bouton **Mot de passe** en haut de l'app, et se déconnecter via
**Déconnexion**.

## Fonctionnalités

- **Tableau** triable (numéro, entreprise, secteur, statut, date de mise en
  ligne) avec recherche libre et filtres par secteur / statut du site /
  statut de modification.
- **Statuts colorés** : Mis en ligne (vert), Maquette envoyée (ambre), En
  attente client (gris), Refus (rouge), Site en cours (violet) — cliquables
  depuis les tuiles de statistiques en haut de page pour filtrer d'un coup.
- **Accès rapide aux réseaux sociaux** : icônes cliquables (Instagram,
  TikTok, Facebook, LinkedIn, YouTube) directement dans le tableau et dans
  la fiche détail, plus boutons **Appeler** et **WhatsApp** générés depuis le
  numéro de téléphone.
- **Fiche client** (panneau latéral) : tous les champs, notes et historique
  de modification, entièrement modifiables une fois connecté.
- **Ajout de clients** : bouton **+ Nouveau client** au-dessus du tableau,
  avec les mêmes champs que la fiche détail.
- **Connexion par compte** : écran de connexion avec un compte par
  collaborateur (Jules, Anis, Reda), changement de mot de passe imposé à la
  première connexion selon des critères de robustesse (majuscule, chiffre,
  caractère spécial, 8 caractères minimum).

## Déploiement sur Vercel

Le dépôt contient `vercel.json` (build Vite standard). Étapes :

1. Sur [vercel.com](https://vercel.com), **Add New → Project**, importer ce
   dépôt GitHub (`maison-zeynaa`).
2. **Root Directory** : comme ce projet vit dans un sous-dossier du dépôt,
   réglez-le sur `hostivo-crm` (bouton *Edit* à côté de "Root Directory"
   pendant la configuration).
3. Le framework Vite est détecté automatiquement à partir de `vercel.json`.
4. Dans **Settings → Environment Variables**, ajoutez :
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (connexion à la base)
   - `BASIC_AUTH_USER` et `BASIC_AUTH_PASSWORD` (pour sécuriser le lien —
     voir ci-dessous)
5. **Deploy**.

## Sécuriser le lien

Comme le CRM affiche des données clients réelles (téléphones, notes), le
projet inclut `middleware.ts` : une authentification HTTP Basic exécutée par
Vercel Edge Middleware, qui protège **toute** l'app derrière un couple
identifiant / mot de passe, avant même de servir la moindre page. Gratuit,
aucun plan Vercel payant requis. C'est une protection complémentaire à la
connexion Supabase — pas un remplacement.

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
    supabaseClient.ts   client Supabase (URL + clé anon)
    clients.ts          lecture des clients (table hostivo_clients)
    clientsWrite.ts      création / mise à jour des clients
    auth.ts             connexion, session, changement de mot de passe (Supabase Auth)
    parse.ts            parsing dates, détection réseau social depuis une URL
    phone.ts            liens tel: / wa.me à partir du numéro
  data/
    sampleData.ts   données de démonstration (hors ligne)
  types.ts      modèle de données Client
```

## Intégration Stripe

L'app peut créer automatiquement des clients Hostivo via Stripe et notifier
des paiements échoués.

### Configuration

1. **Ajouter les secrets Stripe** dans **Project Settings → Secrets** du
   [dashboard Supabase](https://supabase.com/dashboard) du projet `ldmwnqbuwryqnoftbxfh` :

   - `STRIPE_SECRET_KEY` : votre clé secrète Stripe (commence par `sk_live_` ou
     `sk_test_`)
   - `STRIPE_WEBHOOK_SECRET` : le secret du webhook Stripe (commence par
     `whsec_`) — généré lors de la création du webhook ci-dessous
   - `RESEND_API_KEY` : votre clé API Resend pour envoyer les mails de rappel
     (optionnel, déjà dans les secrets)
   - `ADMIN_EMAIL` : l'adresse email qui recevra les notifications de paiements
     échoués (ex. `contact@hostivo.fr`)

2. **Créer le webhook dans Stripe** :

   - Allez sur [dashboard.stripe.com](https://dashboard.stripe.com) →
     **Developers → Webhooks** → **Add endpoint**.
   - **Endpoint URL** : `https://ldmwnqbuwryqnoftbxfh.supabase.co/functions/v1/stripe-webhook`
   - **Events to send** : sélectionnez au minimum :
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.requires_action`
   - Cliquez sur **Reveal** pour voir le secret du webhook (`whsec_...`), et
     copiez-le dans le secret `STRIPE_WEBHOOK_SECRET` (voir étape 1).

3. **Déployer les Edge Functions** : Les deux fonctions
   `stripe-webhook` et `send-payment-reminder` se trouvent dans
   `supabase/functions/` et sont déployées automatiquement lors du
   `supabase deploy` ou du redéploiement du projet.

### Flux

1. Un client passe une commande via votre plateforme Stripe avec ses
   informations (nom, email, téléphone, secteur).
2. **`payment_intent.succeeded`** : Stripe envoie le webhook → la fonction
   `stripe-webhook` crée automatiquement une ligne dans `hostivo_clients` et
   enregistre le paiement dans `stripe_payments`.
3. **`payment_intent.payment_failed`** : Stripe envoie le webhook → la fonction
   enregistre l'échec et son motif.
4. Dans l'app, le bouton **Paiements** (en haut à droite) affiche les
   paiements en attente, échoués ou nécessitant une action du client.
5. Cliquez sur **Rappeler** pour envoyer un email de notification à
   `ADMIN_EMAIL` via Resend, ou **Supprimer** pour nettoyer les vieux
   enregistrements.

### Tables

- `public.stripe_payments` : un enregistrement par intent Stripe, avec le
  statut du paiement (pending, succeeded, failed, requires_payment_method),
  la raison de l'échec le cas échéant, et le timestamp du dernier rappel
  envoyé.

## Base de données Supabase

Le projet réutilise un projet Supabase existant (partagé avec l'app Maison
Zeyna), avec des tables dédiées préfixées `hostivo_` pour ne rien mélanger :

- `public.hostivo_clients` : une ligne par client (numéro, dates, secteur,
  réseaux souhaités, liens, statut du site, statut de modification, notes…).
- `public.hostivo_profiles` : un profil par compte utilisateur (`id` = même
  UUID que dans `auth.users`), avec le nom affiché et l'obligation ou non de
  changer son mot de passe.
- `public.stripe_payments` : suivi des paiements Stripe.

Les tables ont RLS activé, avec des règles réservées au rôle
`authenticated` — aucun accès anonyme, contrairement à l'ancien Sheet public.
