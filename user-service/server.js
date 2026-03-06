// ============================================================
// USER SERVICE
// - gRPC  :50051 → pour que ReviewService puisse l'appeler
// - REST  :3001  → pour que l'API Gateway puisse l'appeler
// - MongoDB      → persistance des données
// ============================================================

const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const express = require('express')
const mongoose = require('mongoose')
const path = require('path')

// ─── Connexion MongoDB ────────────────────────────────────────
mongoose.connect('mongodb+srv://simoxx230_db_user:HtyS9IT43VWG2sBU@cluster0.bnxtwql.mongodb.net/users_db')
  .then(() => console.log('[UserService] ✅ MongoDB connecté'))
  .catch(err => console.error('[UserService] ❌ MongoDB erreur :', err))

// ─── Schéma et modèle ─────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  id:       { type: Number, unique: true },
  name:     { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
})
const User = mongoose.model('User', UserSchema)

// ─── Seed initial ─────────────────────────────────────────────
async function seedUsers() {
  const count = await User.countDocuments()
  if (count === 0) {
    await User.insertMany([
      { id: 1, name: 'Alice', username: 'alice', password: 'alice123' },
      { id: 2, name: 'Bob', username: 'bob', password: 'bob123' },
      { id: 3, name: 'Charlie', username: 'charlie', password: 'charlie123' }
    ])
    console.log('[UserService] Base de données initialisée')
  }
}
seedUsers()

// ─── Chargement du proto ──────────────────────────────────────
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '../proto/user.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
)
const userProto = grpc.loadPackageDefinition(packageDefinition).user

// ─── Implémentation gRPC ──────────────────────────────────────
async function GetUser(call, callback) {
  console.log(`[UserService] gRPC GetUser id=${call.request.id}`)
  const user = await User.findOne({ id: call.request.id })
  if (!user) {
    return callback({
      code: grpc.status.NOT_FOUND,
      message: `Utilisateur id=${call.request.id} introuvable`
    })
  }
  callback(null, { id: user.id, name: user.name, username: user.username, password: user.password })
}

// ─── Démarrage serveur gRPC ───────────────────────────────────
const grpcServer = new grpc.Server()
grpcServer.addService(userProto.UserService.service, { GetUser })
grpcServer.bindAsync(
  '0.0.0.0:50051',
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('[UserService] ❌ gRPC erreur :', err)
    console.log(`[UserService] ✅ Serveur gRPC démarré sur le port ${port}`)
  }
)

// ─── API REST (pour l'API Gateway) ───────────────────────────
const app = express()
app.use(express.json())

// GET /users → liste tous les utilisateurs
app.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, { _id: 0, __v: 0 })
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /users/:id → récupère un utilisateur par id
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ id: Number(req.params.id) }, { _id: 0, __v: 0 })
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /users → crée un nouvel utilisateur
app.post('/users', async (req, res) => {
  try {
    const last = await User.findOne().sort({ id: -1 })
    const newId = last ? last.id + 1 : 1
    const { name, username, password } = req.body

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'name, username et password sont requis' })
    }

    const user = new User({ id: newId, name, username, password })
    await user.save()
    res.status(201).json({ id: user.id, name: user.name, username: user.username, password: user.password })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /health → santé du service
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' })
})

app.listen(3001, () => {
  console.log('[UserService] ✅ API REST démarrée sur http://localhost:3001')
})