const mongo = require("mongoose")
const { default: mongoose } = require("mongoose")
const db_schema = mongo.Schema({
    first_name: {
        type: String,
        requireed: true,
    },
    last_name: {
        type: String,
    },
    gender: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    }
},
    { timeStamp: true },

)
const db = mongoose.model("users", db_schema)

module.exports={mongo,db,db_schema}