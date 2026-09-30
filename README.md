# jira-tui

Jira dans le terminal. Presque tout passe par une palette de commandes : **Ctrl+K** (ou `:`).

## Installation

Prérequis : Node 22 ou plus.

```sh
npm install -g @mikexrmn/jira-tui
jira-tui
```

Depuis les sources :

```sh
pnpm install
pnpm dev
```

## Créer un API token Jira

1. Va sur <https://id.atlassian.com/manage-profile/security/api-tokens>.
2. « Créer un jeton d'API », donne-lui un nom, copie-le.
3. Au premier lancement, saisis l'adresse de ton site (`monsite.atlassian.net`), ton e-mail Atlassian et le token.

Le token est rangé dans le trousseau du système (macOS, Windows, Linux). Il n'est jamais écrit dans un fichier. L'adresse, l'e-mail et le projet choisi sont dans `~/.config/jira-tui/config.json`.

## Langue

L'interface suit la langue de l'OS (français ou anglais) ; toute autre langue s'affiche en anglais.

## Raccourcis

| Touche | Action |
|---|---|
| `Ctrl+K` ou `:` | Ouvrir la palette de commandes |
| `Échap` | Fermer la palette, revenir en arrière |
| `←↑↓→` ou `hjkl` | Naviguer sur le tableau |
| `r` | Rafraîchir |
| `/` | Ouvrir la recherche |
| `Entrée` | Ouvrir le ticket (dans les résultats de recherche) |
| `q` | Quitter |

## Dans la palette

- **Ticket sélectionné ou ouvert** : déplacer vers un statut, m'assigner, désassigner, assigner à…, ouvrir dans le navigateur, copier la clé ou le lien.
- **Navigation** : aller à un ticket (par clé ou titre), afficher le tableau, rechercher.
- **Recherche** : texte libre, filtres multi-sélection (statut, assigné, type, priorité, étiquette, sprint), mes tickets, requête JQL, filtres favoris, recherche par défaut lancée à l'accueil (par projet).
- **Application** : aide des raccourcis, thème clair ou sombre, changer de projet, se déconnecter, quitter.

Plusieurs valeurs dans un même filtre élargissent la recherche (« ou »). Plusieurs filtres ensemble la resserrent (« et »).

## Limites de la V1

Jira Cloud, un compte, un seul projet à la fois. Pas de création de ticket, ni de modification du titre, de la priorité ou des commentaires.

## Développement

```sh
pnpm test       # tests unitaires
pnpm test:e2e   # test dans un vrai terminal (tui-test)
pnpm lint
```

Publier : `git tag vX.Y.Z && git push --tags` (nécessite le secret `NPM_TOKEN`).
