# Donghua VF Player

Une petite application web responsive permettant de créer une bibliothèque personnelle de donghua en VF et de lire des vidéos depuis des liens directs autorisés.

## Fonctionnalités

- Ajout d'un titre, d'un épisode, d'une couverture et d'un lien vidéo
- Lecture dans le navigateur
- Recherche
- Statuts : à voir, en cours, terminé
- Données conservées localement dans le navigateur
- Interface adaptée aux téléphones

## Utilisation

1. Télécharge ou clone le projet.
2. Ouvre `index.html` dans un navigateur.
3. Ajoute un lien direct vers une vidéo MP4 ou WebM que tu possèdes ou que tu as légalement le droit de regarder.

## Publication avec GitHub Pages

1. Crée un dépôt GitHub.
2. Envoie les fichiers du projet dans le dépôt.
3. Ouvre **Settings > Pages**.
4. Choisis **Deploy from a branch**.
5. Sélectionne la branche `main` et le dossier `/root`.
6. Enregistre.

## Limites

- Certains hébergeurs bloquent la lecture externe avec leurs règles CORS.
- Les flux HLS `.m3u8` ne sont pas pris en charge par tous les navigateurs sans bibliothèque supplémentaire.
- Le projet ne récupère pas de vidéos depuis des plateformes tierces et ne contourne aucun DRM.
