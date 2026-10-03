const{mongo, db, db_schema}=require("../model/model.js")

async function get_user(req,res) {
    const user11 = await db.find({})
    res.send(user11)
}

async function get_user_by_id(req,res) {
    const id = req.params.id

    const user = await db.findById(id)
    if (!user) {
        return res.status(404).json({ error: "user not found" })
    }
    else {
        res.send(user)
        
    }
}


async function create_user(req,res) {
    const body = req.body
    db.create({
        first_name: body.first_name,
        last_name: body.last_name,
        gender: body.gender,
        email: body.email,

    })
    res.send("ggg")
}

async function update_user(req,res) {
    const id = req.params.id
    const body = req.body
    const user = await db.findByIdAndUpdate(id, body)
    if (!user) {
        return res.status(404).json({ error: "user not found" })
    }
    else {
        const updated_user = await db.findById(id)
        res.send(`${updated_user}---User Updated successfully`)

    }
}

async function delete_user(req,res) {
    const id = req.params.id
    const user= await db.findById(id)
    if (!user) {
        return res.status(404).json({ error: "user not found" })
    }
    else {

        const user = await db.findByIdAndDelete(id)
        res.send(`User deleted successfully`)

    }    
}

module.exports={get_user,get_user_by_id,create_user,update_user,delete_user}