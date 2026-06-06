# Snap Tap — version multijoueur

Le jeu de cartes Snap Tap, mais chacun joue sur **son** tel ou ordi. Le créateur de la room obtient un **code à 4 lettres** qu'il partage à ses potes ; ils rejoignent depuis n'importe où.

- Main de 7 cartes par personne (privée)
- Le **boss** annonce J'AIME ou J'AIME PAS
- Chacun pose une carte face cachée
- Le boss choisit sa préférée → +1 point, devient le nouveau boss
- Premier à **5 points** gagne

Stack : React (Vite) + Firebase Realtime Database + Tailwind, déployable sur Vercel en gratuit.

---

## 🚀 Setup pas à pas

### 1. Installer Node.js (une seule fois)

Si tu ne l'as pas déjà : télécharge la version **LTS** sur [nodejs.org](https://nodejs.org/) et installe.

Vérifie dans un terminal :
```bash
node --version
npm --version
```

### 2. Créer un projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com/)
2. Connecte-toi avec un compte Google
3. Clique sur **« Ajouter un projet »**
4. Nom du projet : `snap-tap` (ou ce que tu veux)
5. Tu peux **désactiver Google Analytics** (pas utile ici)
6. Clique sur **« Créer le projet »**

### 3. Activer la Realtime Database

1. Dans le menu de gauche de Firebase Console : **Build → Realtime Database**
2. Clique sur **« Créer une base de données »**
3. Choisis la région **`europe-west1`** (ou la plus proche de toi)
4. Choisis **« Démarrer en mode test »** (les règles autorisent lecture/écriture pour tous — ok pour ce projet)
5. Clique sur **Activer**

⚠️ Le mode test expire après 30 jours. Pour le garder, va dans l'onglet **Règles** de ta database et remplace par :
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
Puis **Publier**. (Ces règles sont permissives — c'est ok pour un jeu de potes, ne mets pas d'infos sensibles dans Firebase.)

### 4. Récupérer la config Firebase

1. Dans Firebase Console, clique sur l'engrenage en haut à gauche → **Paramètres du projet**
2. Descends jusqu'à **« Tes applications »**
3. Clique sur l'icône **`</>`** (Web) pour ajouter une app web
4. Donne un surnom (ex: `snap-tap-web`), pas besoin de Firebase Hosting
5. Tu vois un objet `firebaseConfig` avec toutes les clés. **Garde-le sous la main.**

### 5. Installer le projet

Dans un terminal, va dans le dossier du projet et fais :
```bash
npm install
```

Crée un fichier `.env` à la racine (copie `.env.example`) et remplis-le avec tes valeurs Firebase :

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=snap-tap.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://snap-tap-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=snap-tap
VITE_FIREBASE_STORAGE_BUCKET=snap-tap.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
```

⚠️ La `databaseURL` n'est **pas** dans le `firebaseConfig` par défaut — récupère-la depuis la page **Realtime Database** (URL en haut, du style `https://xxx-default-rtdb.europe-west1.firebasedatabase.app`).

### 6. Tester en local

```bash
npm run dev
```

Va sur l'URL affichée (généralement `http://localhost:5173`). Ouvre **plusieurs onglets** (ou plusieurs navigateurs) pour simuler plusieurs joueurs. Crée une room dans un onglet, rejoins avec le code depuis les autres.

### 7. Déployer sur Vercel

#### a) Pousser le code sur GitHub
1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas
2. Crée un **nouveau repo** (privé ou public, comme tu veux), ne coche rien (pas de README pré-créé)
3. Dans ton terminal :
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/TONUSER/TONREPO.git
git push -u origin main
```
(Si tu n'as jamais utilisé Git : tu peux aussi installer **GitHub Desktop** et tout faire en clic-clic.)

#### b) Connecter à Vercel
1. Va sur [vercel.com](https://vercel.com) et connecte-toi avec ton compte GitHub
2. Clique sur **« Add New… → Project »**
3. Importe ton repo
4. Dans **Environment Variables**, ajoute **toutes** les variables de ton `.env` une par une (clé + valeur)
5. Clique sur **Deploy**

Vercel te donne une URL du type `https://snap-tap-xyz.vercel.app`. **Partage-la à tes potes.** Chaque mise à jour de ton repo GitHub redéploiera automatiquement.

---

## 🎮 Comment jouer

1. Une personne ouvre le lien, tape son prénom et **« Créer une partie »** → elle reçoit un code à 4 lettres
2. Les autres ouvrent le même lien, tapent leur prénom et le **code** → ils apparaissent dans le salon
3. Le **host** (créateur) choisit les catégories et clique **« Lancer la partie »**
4. À chaque tour :
   - Le **boss** voit ses 2 boutons J'AIME / J'AIME PAS
   - Les autres voient leur main de 7 cartes et en posent une
   - Le boss voit les cartes posées (mélangées, anonymes) et choisit sa préférée
   - L'auteur·e est révélé·e → +1 point → devient le nouveau boss
5. Premier à **5 points** gagne

---

## 🛠 Limites connues

- **Si le host quitte la page**, la partie peut se bloquer au moment de passer au tour suivant. Solution : le host quitte proprement via le bouton « Quitter » (le rôle de host passe à un autre joueur).
- **Pas d'auth** : n'importe qui avec le code à 4 lettres peut rejoindre.
- **Pas de reconnexion auto** : si quelqu'un ferme l'onglet brutalement, sa main reste mais il faut qu'il revienne avec le même code (son identité est stockée localement).
- **Free tier Firebase** : largement suffisant pour des soirées entre potes (la free tier supporte des dizaines de parties simultanées).

---

## 📁 Structure du code

```
src/
  ├── App.jsx              # Routing principal (Home / Lobby / Game)
  ├── firebase.js          # Init Firebase
  ├── cards.js             # Toutes les cartes par catégorie
  ├── utils.js             # Helpers (shuffle, IDs, format)
  ├── components/
  │   ├── Home.jsx         # Écran d'accueil (créer / rejoindre)
  │   ├── Lobby.jsx        # Salon d'attente
  │   └── Game.jsx         # Toutes les phases de jeu
  ├── index.css            # Tailwind
  └── main.jsx             # Entrée React
```

Toutes les données du jeu vivent sous `rooms/<CODE>/` dans Firebase Realtime Database. Pour ajouter des cartes ou des catégories, édite `src/cards.js`.

Bon jeu 🎉
