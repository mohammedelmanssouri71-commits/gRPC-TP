  # TP gRPC — 3 Microservices : User, Movie, Review

  ## Structure du projet

  ```
  grpc-tp/
  ├── proto/
  │   ├── user.proto          ← Contrat du UserService
  │   ├── movie.proto         ← Contrat du MovieService
  │   └── review.proto        ← Contrat du ReviewService
  │
  ├── user-service/
  │   ├── package.json
  │   └── server.js           ← Serveur gRPC port 50051
  │
  ├── movie-service/
  │   ├── package.json
  │   └── server.js           ← Serveur gRPC port 50052
  │
  └── review-service/
      ├── package.json
      ├── server.js           ← Serveur gRPC (50053) + API REST (3000)
      └── test-client.js      ← Client de test gRPC
  ```

  ---

  ## Étapes d'installation et de lancement

  ### Étape 1 — Installer les dépendances dans chaque service

  Ouvrir 3 terminaux et exécuter dans chacun :

  ```bash
  # Terminal 1 — User Service
  cd user-service
  npm install

  # Terminal 2 — Movie Service
  cd movie-service
  npm install

  # Terminal 3 — Review Service
  cd review-service
  npm install
  ```

  ### Étape 2 — Démarrer les services (dans l'ordre !)

  Il est important de démarrer d'abord UserService et MovieService
  avant le ReviewService, car ce dernier en dépend.

  ```bash
  # Terminal 1 — Démarrer le User Service (port 50051)
  cd user-service
  node server.js

  # Terminal 2 — Démarrer le Movie Service (port 50052)
  cd movie-service
  node server.js

  # Terminal 3 — Démarrer le Review Service (port 50053 + HTTP 3000)
  cd review-service
  node server.js
  ```

  Vous devriez voir dans les logs :
  ```
  [UserService]   ✅ Serveur gRPC démarré sur le port 50051
  [MovieService]  ✅ Serveur gRPC démarré sur le port 50052
  [ReviewService] ✅ Serveur gRPC démarré sur le port 50053
  [ReviewService] ✅ API REST démarrée sur http://localhost:3000
  ```

  ### Étape 3 — Tester avec le client gRPC

  ```bash
  # Dans un 4e terminal
  cd review-service
  node test-client.js
  ```

  ### Étape 4 — Tester avec l'API REST (curl ou Postman)

  ```bash
  # Créer un avis valide (Alice commente Inception)
  curl -X POST http://localhost:3000/reviews \
    -H "Content-Type: application/json" \
    -d '{"userId": 1, "movieId": 1, "comment": "Film incroyable !"}'

  # Créer un avis avec utilisateur inexistant
  curl -X POST http://localhost:3000/reviews \
    -H "Content-Type: application/json" \
    -d '{"userId": 99, "movieId": 1, "comment": "Test"}'

  # Voir tous les avis enregistrés
  curl http://localhost:3000/reviews

  # Vérifier la santé du service
  curl http://localhost:3000/health
  ```

  ---

  ## Schéma de communication entre les services

  ```
  ┌─────────────┐    HTTP POST /reviews    ┌────────────────────┐
  │   Client    │ ───────────────────────► │  Review Service    │
  │ (curl/HTTP) │                          │  Port 3000 (REST)  │
  └─────────────┘                          │  Port 50053 (gRPC) │
                                          └────────┬───────────┘
                                                    │
                                ┌───────────────────┼───────────────────┐
                                │ gRPC GetUser       │ gRPC GetMovie     │
                                ▼                   ▼                   │
                    ┌──────────────────┐  ┌──────────────────┐        │
                    │  User Service    │  │  Movie Service   │        │
                    │  Port 50051      │  │  Port 50052      │        │
                    └──────────────────┘  └──────────────────┘        │
  ```

  ---

  ## Données disponibles pour les tests

  **Utilisateurs (User Service) :**
  | id | name    |
  |----|---------|
  | 1  | Alice   |
  | 2  | Bob     |
  | 3  | Charlie |

  **Films (Movie Service) :**
  | id | title             |
  |----|-------------------|
  | 1  | Inception         |
  | 2  | Interstellar      |
  | 3  | The Dark Knight   |
  | 4  | Parasite          |

  ---

  ## Réponses aux questions d'analyse

  ### 1. Pourquoi utilise-t-on un fichier .proto ?

  Le fichier `.proto` joue le rôle de **contrat d'interface** entre les services.
  Il définit de façon stricte et précise :
  - Quelles méthodes sont disponibles (`rpc GetUser`, `rpc GetMovie`...)
  - Quels paramètres elles acceptent (`UserRequest`, `MovieRequest`...)
  - Ce qu'elles retournent (`UserResponse`, `MovieResponse`...)

  Sans ce contrat, chaque service pourrait envoyer des données dans un format
  différent et les incompatibilités seraient détectées seulement à l'exécution.
  Avec `.proto`, si le contrat change de façon incompatible, le code ne compile
  plus — l'erreur est détectée tôt.

  Il sert aussi de **documentation vivante** : en lisant le fichier `.proto`,
  on comprend immédiatement ce que fait un service, sans lire son code source.

  Enfin, `.proto` permet la **génération automatique de code** : à partir d'un seul
  fichier, gRPC génère le code client et serveur en Go, Python, Java, Node.js, etc.

  ### 2. Quelle est la différence entre gRPC et REST ?

  | Aspect          | gRPC                             | REST                          |
  |-----------------|----------------------------------|-------------------------------|
  | Protocole       | HTTP/2                           | HTTP/1.1                      |
  | Format          | Protobuf (binaire, compact)      | JSON (texte, lisible)         |
  | Contrat         | Fichier .proto (obligatoire)     | OpenAPI/Swagger (optionnel)   |
  | Typage          | Strict, vérifié à la compilation | Dynamique, vérifié à l'exécution |
  | Performance     | Très élevée (binaire + HTTP/2)   | Modérée (texte + HTTP/1.1)    |
  | Streaming       | Natif (4 modes)                  | Non natif (WebSocket, SSE)    |
  | Navigateur      | Nécessite grpc-web + proxy       | Natif (fetch, XMLHttpRequest) |
  | Débogage        | Difficile (binaire illisible)    | Simple (curl, navigateur)     |
  | Génération code | Automatique (protoc)             | Optionnelle (openapi-generator)|

  **Résumé :** gRPC est privilégié pour les communications **entre microservices**
  (backend to backend) où la performance est clé. REST est préféré pour les
  **API exposées aux clients** (navigateurs, apps mobiles) où la simplicité prime.

  ### 3. Que se passe-t-il si le User Service est indisponible ?

  Si le User Service est arrêté et qu'on appelle `CreateReview`, la callback gRPC
  reçoit une erreur avec le code `UNAVAILABLE` (code 14).

  Dans notre implémentation, on gère ce cas avec :
  ```javascript
  userClient.GetUser({ id: userId }, (userErr, user) => {
    if (userErr || !user || !user.id) {
      return callback(null, { message: '❌ Erreur : Utilisateur non trouvé' })
    }
    // ...
  })
  ```

  Sans cette gestion, l'erreur se propage et crash le service.

  **En production**, on ajouterait des mécanismes de résilience comme :
  - **Circuit Breaker** : stopper les appels vers un service en panne pour éviter
    l'effet domino (librairie : `opossum`)
  - **Retry avec backoff exponentiel** : réessayer automatiquement après 1s, 2s, 4s...
  - **Timeout** : ne pas attendre indéfiniment une réponse d'un service lent
  - **Fallback** : retourner une réponse dégradée si le service est indisponible

  ### 4. Pourquoi gRPC est-il plus performant que REST ?

  Trois raisons principales expliquent cette supériorité :

  **Protobuf vs JSON :** Protobuf encode les données en binaire en utilisant des
  numéros de champs (1, 2, 3...) au lieu des noms complets. Le message
  `{ "userId": 1, "movieId": 2, "comment": "Super" }` occupe ~40 octets en JSON
  mais seulement ~12 octets en Protobuf. La sérialisation/désérialisation est
  aussi 3 à 5 fois plus rapide.

  **HTTP/2 vs HTTP/1.1 :** HTTP/2 permet la multiplexion — plusieurs requêtes
  peuvent voyager simultanément sur la même connexion TCP. HTTP/1.1 traite les
  requêtes séquentiellement (ou ouvre de nouvelles connexions, ce qui est coûteux).
  HTTP/2 compresse aussi les headers, qui représentent parfois 80% de la taille
  d'une requête REST.

  **Connexions persistantes :** Dans gRPC, la connexion TCP entre deux services
  est établie une seule fois et réutilisée pour tous les appels. REST ouvre
  (ou réutilise avec keep-alive) des connexions à chaque requête, ce qui génère
  une latence supplémentaire.

  **Résultat concret :** Dans les benchmarks de Google, gRPC est entre 7 et 10 fois
  plus rapide que REST/JSON pour les communications inter-services.

  ### 5. Quels sont les avantages de la communication synchrone ?

  La communication synchrone signifie que l'appelant **attend** la réponse avant
  de continuer. C'est ce que fait notre Review Service : il attend la réponse de
  UserService, puis attend celle de MovieService, avant de répondre au client.

  **Avantages :**
  - **Cohérence immédiate :** On est certain que les données sont valides avant
    d'agir. Si l'utilisateur n'existe pas, on le sait immédiatement.
  - **Simplicité du code :** Le flux est linéaire et facile à comprendre.
    L'erreur est propagée directement à l'appelant.
  - **Feedback direct :** Le client reçoit une réponse confirmant le succès ou
    l'échec de toute la chaîne d'opérations en un seul appel.
  - **Traçabilité :** Il est facile de suivre le chemin d'une requête pour le débogage.

  **Inconvénients (à connaître) :**
  - **Couplage temporel :** Si UserService est lent, ReviewService est bloqué.
  - **Résilience fragile :** Une panne en cascade est possible (si A appelle B
    qui appelle C, la panne de C bloque B qui bloque A).
  - **Scalabilité limitée :** Pour les opérations longues, la communication
    asynchrone (avec des queues comme Kafka ou RabbitMQ) est préférable.

  ---

  ## Concepts clés à retenir

  **Serveur gRPC :** Expose des méthodes définies dans un `.proto` et les implémente.
  Exemple : `UserService` expose `GetUser` sur le port 50051.

  **Client gRPC :** Se connecte à un serveur gRPC distant et appelle ses méthodes
  comme si elles étaient locales. Exemple : `ReviewService` crée un `userClient`
  pour appeler `GetUser` sur `localhost:50051`.

  **Un service peut être les deux :** `ReviewService` est à la fois serveur
  (il reçoit `CreateReview`) et client (il appelle `GetUser` et `GetMovie`).
  C'est une architecture très courante dans les microservices.

  **proto-loader :** En Node.js, on n'utilise pas `protoc` pour générer du code.
  `@grpc/proto-loader` charge le fichier `.proto` directement au runtime.
  C'est plus simple pour le développement mais moins performant en production
  que le code généré.

---

## Nouveau : Client React + Auth JWT

Le projet inclut maintenant :

- Un **client React** dans `client/` (CSS classique, sans framework UI).
- Une authentification **JWT** dans l'`api-gateway`.

### 1) Lancer le front React

```bash
cd client
npm install
npm run dev
```

Le front est disponible sur `http://localhost:5173`.

### 2) Authentification JWT (API Gateway)

Le gateway expose :

- `POST /auth/login` : retourne un token JWT.
- `GET /auth/me` : retourne l'utilisateur authentifié.
- Toutes les routes `/api/*` nécessitent un header `Authorization: Bearer <token>`.

Identifiants de démo par défaut :

- `username: admin`
- `password: admin123`

Exemple :

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Ensuite utiliser `token` reçu dans les appels `/api/users`, `/api/movies`, `/api/reviews`.
