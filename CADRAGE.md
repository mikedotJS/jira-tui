# Cadrage produit : Jira dans le terminal

Promesse : tout ce qu'on fait au quotidien dans Jira se fait au clavier, depuis une palette de commandes unique.

## 1. Raccourci de la palette

- **Ctrl+K** ouvre la palette depuis n'importe quel écran. **Échap** la ferme.
- **`:`** fait la même chose, pour les terminaux qui interceptent Ctrl+K.
- K seul est écarté : il bloque la saisie de texte et la navigation `j/k`.
- Cmd+K est écarté : sur macOS, l'application ne le reçoit jamais.

## 2. Écrans

| Écran | Contenu |
|---|---|
| Connexion | Adresse Jira, e-mail, API token. Test immédiat, token rangé dans le trousseau du système. |
| Choix du projet | Liste filtrable. Le dernier projet est mémorisé. |
| Accueil | Écran vide qui invite à chercher (« Ctrl+K ou : pour chercher ou filtrer »). Aucun ticket affiché tant qu'aucune recherche ni aucun filtre n'est lancé, sauf si le projet a une recherche par défaut : elle se lance alors toute seule. |
| Tableau | Colonnes du board, cartes avec clé, titre, assigné et priorité. Accessible à la demande via « Afficher le tableau », jamais à l'ouverture. |
| Détail d'un ticket | Statut, type, priorité, assigné, labels, sprint, description, commentaires. |
| Recherche | Texte libre + filtres multi-select : statut, assigné, type, priorité, label, sprint. |

Filtres : plusieurs valeurs dans un même filtre élargissent la recherche (« assigné à X ou Y »). Plusieurs filtres ensemble la resserrent (« et en cours »). Le filtre sprint propose « Sprint actif » en premier choix. Il est masqué si le projet n'utilise pas de sprints.

Tableau (une fois affiché), détail et résultats de recherche se mettent à jour automatiquement, toutes les 30 secondes environ, sans faire sauter la sélection en cours.

## 3. Actions de la palette

**Ticket sélectionné ou ouvert**
- Déplacer vers un statut (seulement les transitions autorisées)
- M'assigner / Assigner à…
- Ouvrir dans le navigateur
- Copier la clé ou le lien

**Navigation**
- Aller à un ticket
- Afficher le tableau
- Rechercher

**Recherche**
- Filtrer par statut, assigné, type, priorité, label ou sprint
- Mes tickets
- Réinitialiser les filtres (retour à l'écran vide, sans toucher à la recherche par défaut)
- Définir / retirer la recherche par défaut du projet (un favori, marqué ★)

**Compte et application**
- Connecter un compte / Se déconnecter
- Aide des raccourcis
- Quitter

## 4. Périmètre V1

- Jira Cloud, un seul compte (e-mail + API token)
- Un seul projet, choisi à la connexion
- Tableau, détail, recherche multi-filtres
- Pas de création de ticket
- Pas de modification du titre, de la priorité ni de commentaire
