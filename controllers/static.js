const user=require("../app/file/MOCK_DATA.json")
const {mongo, db, db_schema}=require("../model/model.js")





async function checking(req,res){
    const fileuser = await user;
    const dbuser = await db.find({})
    return res.render("home" , { 
            "get": fileuser,
            "tb": dbuser
    })
}

module.exports=checking