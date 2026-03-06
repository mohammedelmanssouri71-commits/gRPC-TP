// ============================================================
// CLIENT DE TEST gRPC
// Ce script teste directement les services via gRPC
// (sans passer par l'API REST Express)
//
// Utilisation : node test-client.js
// ============================================================

const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const path = require('path')

// Charger les proto files
const userDef = protoLoader.loadSync(path.join(__dirname, '../proto/user.proto'), {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
})
const movieDef = protoLoader.loadSync(path.join(__dirname, '../proto/movie.proto'), {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
})
const reviewDef = protoLoader.loadSync(path.join(__dirname, '../proto/review.proto'), {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
})

// Créer les clients
const userProto = grpc.loadPackageDefinition(userDef).user
const movieProto = grpc.loadPackageDefinition(movieDef).movie
const reviewProto = grpc.loadPackageDefinition(reviewDef).review

const userClient = new userProto.UserService('localhost:50051', grpc.credentials.createInsecure())
const movieClient = new movieProto.MovieService('localhost:50052', grpc.credentials.createInsecure())
const reviewClient = new reviewProto.ReviewService('localhost:50053', grpc.credentials.createInsecure())

// Fonction utilitaire pour afficher les résultats proprement
function log(title, data) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`TEST : ${title}`)
  console.log(`${'='.repeat(50)}`)
  console.log(JSON.stringify(data, null, 2))
}

// ============================================================
// TEST 1 : Récupérer un utilisateur existant
// ============================================================
console.log('\n🚀 Démarrage des tests gRPC...\n')

userClient.GetUser({ id: 1 }, (err, response) => {
  if (err) {
    log('GetUser(id=1) - ERREUR', { code: err.code, message: err.message })
  } else {
    log('GetUser(id=1) - SUCCÈS', response)
  }
})

// ============================================================
// TEST 2 : Récupérer un utilisateur inexistant
// ============================================================
setTimeout(() => {
  userClient.GetUser({ id: 99 }, (err, response) => {
    if (err) {
      log('GetUser(id=99) - ERREUR ATTENDUE (utilisateur inexistant)', { 
        code: err.code, 
        message: err.message 
      })
    } else {
      log('GetUser(id=99)', response)
    }
  })
}, 500)

// ============================================================
// TEST 3 : Récupérer un film existant
// ============================================================
setTimeout(() => {
  movieClient.GetMovie({ id: 2 }, (err, response) => {
    if (err) {
      log('GetMovie(id=2) - ERREUR', { code: err.code, message: err.message })
    } else {
      log('GetMovie(id=2) - SUCCÈS', response)
    }
  })
}, 1000)

// ============================================================
// TEST 4 : Créer un avis valide (utilisateur ET film existent)
// ============================================================
setTimeout(() => {
  reviewClient.CreateReview({ userId: 1, movieId: 1, comment: 'Film incroyable !' }, (err, response) => {
    if (err) {
      log('CreateReview (cas valide) - ERREUR', { code: err.code, message: err.message })
    } else {
      log('CreateReview (cas valide) - SUCCÈS', response)
    }
  })
}, 1500)

// ============================================================
// TEST 5 : Créer un avis avec un utilisateur inexistant
// ============================================================
setTimeout(() => {
  reviewClient.CreateReview({ userId: 99, movieId: 1, comment: 'Test utilisateur invalide' }, (err, response) => {
    if (err) {
      log('CreateReview (userId=99 inexistant) - ERREUR', { code: err.code, message: err.message })
    } else {
      log('CreateReview (userId=99 inexistant) - RÉPONSE', response)
    }
  })
}, 2000)

// ============================================================
// TEST 6 : Créer un avis avec un film inexistant
// ============================================================
setTimeout(() => {
  reviewClient.CreateReview({ userId: 2, movieId: 99, comment: 'Test film invalide' }, (err, response) => {
    if (err) {
      log('CreateReview (movieId=99 inexistant) - ERREUR', { code: err.code, message: err.message })
    } else {
      log('CreateReview (movieId=99 inexistant) - RÉPONSE', response)
    }
  })
}, 2500)

setTimeout(() => {
  console.log('\n✅ Tous les tests sont terminés.\n')
}, 3000)
