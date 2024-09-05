const mongoose = require('mongoose')

const cusineaiSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String
})

const cusineaiModel = mongoose.model("users", cusineaiSchema)
module.exports = cusineaiModel
