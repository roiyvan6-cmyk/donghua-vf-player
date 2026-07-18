# Donghua VF Player V5

## Nouvelle organisation

La bibliothèque affiche maintenant une seule carte par donghua.

Chaque fiche contient :

- le titre ;
- le synopsis ;
- la couverture ;
- le statut ;
- le favori ;
- tous les épisodes du donghua ;
- un bouton « Ajouter un épisode ».

Le lecteur contient :

- épisode précédent ;
- épisode suivant ;
- retour à la fiche du donghua ;
- progression pour les vidéos directes ;
- marquage comme regardé.

## Migration V4.1 → V5

Au premier lancement, l’application essaie de regrouper automatiquement les anciens éléments portant exactement le même titre dans une seule fiche de donghua.

Exemple :

- Renegade Immortal — épisode 1
- Renegade Immortal — épisode 2

deviennent :

- Renegade Immortal
  - épisode 1
  - épisode 2

## Sources compatibles

- YouTube intégré ;
- playlist YouTube ;
- lien vidéo direct ;
- URL officielle d’intégration d’une autre plateforme ;
- fichier vidéo local depuis l’iPhone ;
- sous-titres personnels `.vtt` pour les vidéos directes/locales.

## Limites

- Les plateformes externes peuvent bloquer leur intégration.
- Les fichiers locaux peuvent devoir être sélectionnés de nouveau après fermeture du navigateur.
- L’application ne télécharge ni n’extrait les vidéos d’une plateforme.
