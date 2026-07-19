# Sécurité Firebase — checklist de mise en service

## 🚨 PLAN D'URGENCE — couper le jeu en 30 secondes

Tout le jeu (web ET app) dépend de Firebase : il existe donc UN disjoncteur
central. En cas de gros problème (abus, bug grave, facture qui s'emballe) :

**COUPER :** Console Firebase → snaptap-party → Realtime Database → Règles →
remplacer TOUT par :

```json
{ "rules": { ".read": false, ".write": false } }
```

→ Publier. Effet immédiat partout, personne ne peut plus rien lire/écrire,
l'app encaisse sans crasher (écrans « Connexion… » / messages d'erreur).

**RALLUMER :** recoller le contenu de `database.rules.json` (la copie de
référence, dans ce repo) dans Console → Règles → Publier. Ou :
`npx firebase-tools deploy --only database`. Puis publier une annonce depuis
`/admin` pour prévenir les joueurs.

**Autres boutons selon le problème :**
- Facture qui s'emballe → console.cloud.google.com → Facturation →
  DÉSACTIVER la facturation du projet (retour instantané aux quotas gratuits,
  la carte est hors d'atteinte ; le jeu tourne en mode Spark).
- Stopper les nouvelles installations → Play Console → Présence sur le
  Play Store → retirer l'app de la vente (les installs existantes restent).
- Compte Google compromis → myaccount.google.com/security → changer le mot
  de passe + déconnecter toutes les sessions (ce compte contrôle TOUT :
  Firebase, Play, facturation → 2FA fortement recommandée).

Le code applique désormais : auth anonyme pour les joueurs, compte email/mot de
passe pour l'admin, règles de sécurité dans `database.rules.json`. Pour que tout
fonctionne, il faut activer ces éléments **dans la console Firebase** (5-10 min).

## 1. Activer l'authentification

Console Firebase → **Authentication** → onglet **Sign-in method** :

- [ ] Activer **Anonyme** (obligatoire : sans ça, plus personne ne peut jouer)
- [ ] Activer **E-mail/Mot de passe**

## 2. Créer le compte admin

Console → **Authentication** → onglet **Users** → **Add user** :

- [ ] Email : ton adresse — Mot de passe : long et unique (gestionnaire de mdp)
- [ ] Copier l'**UID** du compte créé (colonne « User UID »)

## 3. Déclarer l'admin dans la base

Console → **Realtime Database** → onglet **Données** :

- [ ] Créer à la racine un nœud :

```
admin/
  <UID copié à l'étape 2>: true
```

(Ce nœud n'est ni lisible ni modifiable par les clients — règles `admin`.)

## 4. Publier les règles de sécurité

Console → **Realtime Database** → onglet **Règles** :

- [ ] Coller le contenu de `database.rules.json` → **Publier**

Ou en CLI : `npx firebase-tools deploy --only database` (le projet contient
`firebase.json` qui pointe vers le fichier de règles).

## 5. Vérifier que tout marche

- [ ] Jouer une partie test (créer room, rejoindre, jouer) → doit marcher
- [ ] Aller sur `/admin`, se connecter avec le compte email → CRUD cartes OK
- [ ] Test négatif : dans la console → Règles → **Simulateur** : une écriture
      sur `cards/x` **sans** auth doit être **refusée**

## Ce que ces règles garantissent

| Chemin | Lecture | Écriture |
|---|---|---|
| `rooms` (liste) | **admin uniquement** (anti-énumération des codes) | — |
| `rooms/$code` | joueurs connectés **qui connaissent le code** | joueurs connectés, code room 4 chars valide |
| `cards`, `categories` | joueurs connectés | **admin uniquement** |
| `deletedDefaults`, `deletedCategories` | joueurs connectés | **admin uniquement** |
| `users/$uid` | le joueur lui-même | **personne côté client** (serveur uniquement) |
| `stats/*` | admin | joueurs connectés, increment-only, borné (+1000 max par écriture) |
| `admin` | personne | personne (console uniquement) |
| tout le reste | refusé | refusé |

Nettoyage des rooms expirées (> 4h) : comme les joueurs ne peuvent plus lister
`/rooms`, le sweep tourne à l'**ouverture du dashboard `/admin`**, et
`createRoom` **réutilise** les codes des rooms expirées. Une room expirée est
aussi supprimée quand un de ses joueurs se reconnecte dessus (App.jsx).

Conséquence : le seed automatique des cartes par défaut (au premier lancement
d'un lobby) ne peut plus être fait par un joueur — c'est voulu. Pour seeder une
base vide : se connecter sur `/admin` (le seed s'exécute à l'ouverture du
dashboard, avec les droits admin).

## Limites connues (assumées pour un jeu d'apéro)

- Un joueur connecté peut écrire dans **n'importe quelle room dont il connaît
  le code** (pas de notion de « membre » vérifiée serveur). Risque : trolling
  d'une partie si le code fuit. Depuis le durcissement des règles, il ne peut
  plus **énumérer** les codes (la liste `/rooms` est admin-only) — il faut
  connaître le code exact.
- **Triche possible en devtools (web)** : un joueur techie peut lire les mains
  des autres et le mapping `played/{playerId}` (qui a posé quoi), et les sorts
  (espion, reroll, va-tout) ne sont vérifiés que côté client. Assumé : jeu
  d'apéro entre amis, pas de compétition.
- L'auth anonyme n'empêche pas un script d'obtenir un jeton anonyme. La vraie
  parade est **App Check** (voir ci-dessous).
- Le contenu des rooms au-delà des champs de base (`settings`, `pool`,
  `hands`…) n'est pas validé par les règles : un client auth peut y écrire des
  données arbitraires. Mitigé par App Check ; durcissable avec des `.validate`.

## Monétisation : attribution des packs (CRITIQUE avant le 1er pack payant)

Le nœud `users/$uid` est en **lecture seule côté client** (`.write: false`).
Le joueur consulte ses droits (`users/$uid/packs`) mais **ne peut pas se les
attribuer** — sinon n'importe qui débloquerait les packs payants gratuitement
en écrivant `packs/pack_coquin: true` depuis la console du navigateur.

L'écriture des packs doit donc se faire **côté serveur uniquement**, après
vérification du reçu d'achat :

- [ ] **Cloud Function / webhook RevenueCat** (Admin SDK, qui contourne les
      règles) qui, à réception d'un achat validé (Play Billing), écrit
      `users/$uid/packs/<packId>: true`.
- [ ] Tant que ce back-end n'existe pas, **aucun pack ne peut être débloqué**
      (c'est voulu : mieux vaut « pas encore de packs » que « packs gratuits
      pour tous »).
- [ ] Rappel : le *contenu* des cartes premium reste téléchargeable par tout
      client (`cards` lisible par tous). Le verrou est côté sélection, pas côté
      données. Acceptable pour des packs à ~2 € ; à revoir si on veut une vraie
      protection du contenu (livraison via fonction serveur).

## À faire plus tard (phase Android / avant gros trafic)

- [~] **Firebase App Check** — EN COURS, plan en 3 phases. Bloque (à terme) les
      clients qui ne sont pas l'app/le site officiels.
      ⚠️ RÈGLE D'OR : ne PAS activer l'« enforcement » (phase 3) avant que les
      phases 1 ET 2 soient faites et vérifiées dans les métriques, sinon TOUTES
      les requêtes sont rejetées et l'app casse.

      **Phase 1 — Web (reCAPTCHA v3), code prêt (firebase.js) :**
      1. Créer une clé reCAPTCHA v3 : https://www.google.com/recaptcha/admin/create
         → type « reCAPTCHA v3 », domaines : `www.snaptapparty.com`,
         `snaptapparty.com`, `snap-tap.vercel.app`, `localhost`.
         → note la CLÉ DE SITE (publique) et la CLÉ SECRÈTE.
      2. Firebase Console → **App Check** → Applications → app **Web** →
         Enregistrer → fournisseur **reCAPTCHA v3** → coller la CLÉ SECRÈTE.
      3. Mettre la CLÉ DE SITE dans `.env` local (`VITE_RECAPTCHA_V3_SITE_KEY=...`)
         ET dans les variables d'env Vercel → redéployer.
      4. En dev (localhost) : au premier lancement, la console du navigateur
         affiche un « debug token » → l'enregistrer dans App Check →
         Applications → ⋮ → Gérer les jetons de débogage.
      5. Vérifier après quelques jours : App Check → Realtime Database →
         le graphe doit montrer une part croissante de requêtes « Vérifiées ».

      **Phase 2 — Android (Play Integrity), CODE PRÊT (19/07) :** plugin
      @capacitor-firebase/app-check installé (a nécessité l'upgrade firebase
      v10→v12, fait), pont natif→JS via CustomProvider dans firebase.js.
      Tant que `android/app/google-services.json` est ABSENT, l'init échoue
      proprement (aucun blocage). Pour finir la phase 2 :
      1. Console Firebase → ⚙️ Paramètres du projet → Vos applications →
         **Ajouter une application → Android** : package `com.snaptap.game`,
         et ajouter les DEUX empreintes SHA-256 :
         - clé de signature Play (App Signing) : B8:AF:BB:70:FD:0C:03:43:AD:
           F3:A1:73:E5:7E:4F:12:24:0F:BF:4C:44:05:A8:96:66:A6:C4:3A:61:F4:52:CC
         - clé d'upload : BA:B7:EC:A8:90:44:C4:C0:… (celle d'assetlinks.json)
      2. Télécharger `google-services.json` → le mettre dans `android/app/`
         (le gradle du template l'applique automatiquement s'il existe).
      3. Console Firebase → App Check → Applications → app **Android** →
         Enregistrer → fournisseur **Play Integrity**.
      4. Rebuild AAB (nouveau versionCode) → upload sur la piste de test →
         installer via le Play Store (Play Integrity ne fonctionne QUE pour
         une app installée depuis Play, pas en sideload/debug).
      5. Vérifier dans App Check → métriques que le trafic app devient
         « vérifié ».

      **Phase 3 — Enforcement :** quand web (phase 1) ET app (phase 2) montrent
      ~100 % de requêtes vérifiées dans les métriques → App Check → Realtime
      Database → « Appliquer ». Les scripts sont alors rejetés par Firebase.
- [ ] **Plan Blaze** + alertes budget : le plan gratuit est limité à
      **100 connexions simultanées** (~15-25 parties en même temps). À activer
      avant toute promo, sinon l'app cesse de répondre aux nouveaux joueurs.
- [x] Exclure la route `/admin` du build natif Android (admin = web only) —
      fait dans App.jsx : `/admin` retombe sur le jeu en natif.
- [x] Mode Apéro web : le flag localStorage `fc_apero_unlocked` ne compte plus
      qu'en DEV. En prod web, seul `users/$uid/packs` (écrit serveur) fait foi —
      avant, une ligne en console débloquait le mode gratuitement.
- [x] Headers de sécurité Vercel (nosniff, X-Frame-Options, Referrer-Policy,
      Permissions-Policy, HSTS) dans vercel.json. Une CSP reste à écrire et
      tester (endpoints Firebase/fonts) — ne pas la poser à l'aveugle.
- [x] `android:allowBackup="false"` (hygiène : pas de backup adb du localStorage).
- [ ] (Hygiène) Passer Firebase du SDK v10 à v11. Les 12 vulns `npm audit`
      viennent de `undici` via `firestore`/`functions`/`storage`, modules NON
      importés → tree-shakés hors du bundle, risque réel faible. À faire à froid
      (pas sur un build prêt à publier), avec re-test complet.

## Déploiement des règles après modification

Toute modif de `database.rules.json` doit être **publiée** pour prendre effet :

```
npx firebase-tools deploy --only database
```

(ou coller le contenu du fichier dans Console → Realtime Database → Règles →
Publier). Tant que ce n'est pas fait, les règles en vigueur restent les
anciennes.
