# Maison Zeyna — Gestion Haute Couture

Logiciel de gestion du showroom : catalogue de robes et de bijoux, base clientes,
réservations, caisse et trésorerie, documents et journal d'activité.

Interface bilingue français / arabe (avec sens de lecture inversé), utilisable
au doigt sur tablette et sur mobile, et installable comme application.

## Lancer en local

```bash
npm install
npm run dev      # http://localhost:3000
```

Autres commandes :

```bash
npm run build    # construit dans dist/
npm run preview  # sert le build de production
npm run lint     # vérification TypeScript
```

## Configuration

La base cloud est renseignée par variables d'environnement. Copiez
`.env.example` vers `.env.local` et adaptez :

```
VITE_SUPABASE_URL="https://votre-projet.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_..."
```

Sans ces variables, l'application utilise le projet par défaut inscrit dans
`src/lib/storage.ts`. La clé publiable est faite pour être servie au
navigateur : l'accès est gouverné par les politiques de sécurité au niveau des
lignes (RLS) de la base, pas par le secret de cette valeur.

## Fonctionnement hors ligne

Les enregistrements sont écrits sur l'appareil **d'abord**, puis répliqués vers
Supabase en arrière-plan. Une réservation, une robe ou une cliente saisie sans
réseau reste donc disponible et survit à un rechargement ; l'indicateur en haut
de l'écran distingue « Données synchronisées » de « Mode hors ligne ».

Une réponse distante vide ne remplace jamais des données locales : c'est ce qui
évite qu'une lecture ratée efface le catalogue.

## Déploiement

Le dépôt contient `vercel.json` (commande de build, dossier de sortie, en-têtes
de cache). Sur Vercel :

1. **Add New → Project**, puis importer ce dépôt ;
2. laisser les réglages détectés — ils viennent de `vercel.json` ;
3. ajouter les deux variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
   dans *Settings → Environment Variables* ;
4. **Deploy**.

Le service worker est servi sans cache, de sorte qu'une nouvelle version est
prise en compte dès la visite suivante.

## Structure

```
src/
  components/   écrans (tableau de bord, réservations, clientes, robes, …)
  lib/
    storage.ts  état, persistance locale et synchronisation Supabase
    dates.ts    source unique de « aujourd'hui »
    toast.ts    notifications non bloquantes
    sync.ts     réplication cloud en arrière-plan
    pwa.ts      enregistrement du service worker
scripts/
  generate-icons.mjs   redessine les icônes de l'application
public/
  sw.js         cache de la coquille applicative
```
