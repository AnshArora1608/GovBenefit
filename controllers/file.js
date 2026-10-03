const user = require("../file/MOCK_DATA.json")


async function get_user(req,res) {
    const get_user=user
    res.send(get_user)

}
async function get_user_by_id(req,res) {
    const id = req.params.id
    console.log(id)
    const get_user = user.find(user => {
        if (user.id == id) {
            let u = user.first_name
            let l = user.last_name
            let g = user.gender
            let e = user.email
            const html =
                `<center>
                <ul>
                <li> hello ${u} ${l}</li>
                <li>you are ${g}</li>
                <li> your email address is ${e}</li>
                </ul > </center>
                `
            res.send(html)
        }})
    
}
async function create_user(req,res) {
    const body = req.body
    console.log(body)
    user.push({ ...body, id: user.length + 1 })

    fs.writeFile('./MOCK_DATA.json', JSON.stringify(user), (err, data) => {
        if (err) {
            console.log(err)
        }
        else {
            return res.json({ status: "pending" })
        }


    })
}

async function update_user(req,res) {
// to get the content from user
const body22 = req.body
// to get the id
const id1 = parseInt(req.params.id)
//to find user
const org_user = user.find(user => user.id === id1)
if (!org_user) {
    res.send("no user found")
    // res.send("hello")
}
//to asign the value if null than original ones
else {
    if (body22.first_name === undefined) {
        org_user.first_name = org_user.first_name
    }
    else {
        org_user.first_name = body22.first_name
    }

    if (body22.last_name === undefined) {
        org_user.last_name = org_user.last_name
    }
    else {
        org_user.last_name = body22.last_name
    }
    if (body22.email === undefined) {
        org_user.email = org_user.email
    }
    else {
        org_user.email = body22.email
    }
    if (body22.gender === undefined) {
        org_user.gender = org_user.gender
    }
    else {
        org_user.gender = body22.gender
    }
    console.log(org_user)
    // to update the original value of user
    user.find(user => {
        if (user.id === id1) {
            user.first_name = org_user.first_name
            user.last_name = org_user.last_name
            user.email = org_user.email
            user.gender = org_user.gender
        }
    })

    // to change the user from the file /database
    fs.writeFile('./MOCK_DATA.json', JSON.stringify(user), (err, data) => {
        if (err) {
            console.log(err)
        }
        else {
            return res.json(`User Updated successfully Name: ${org_user.first_name} ${org_user.last_name} Gender:${org_user.gender} Email:${org_user.email}`)
        }
    })

}


}

async function delete_user(req,res) {
    const del_id = parseInt(req.params.id)
    // console.log(del_id)
    const del_user = user.find(user => user.id === del_id)
    if (!del_user) {
        res.send("No User Found!!!")
    }
    // console.log(del_user)
    else {
        user.pop(user => user.id = del_id)
        fs.writeFile('./MOCK_DATA.json', JSON.stringify(user), (err, data) => {
            if (err) {
                console.log(err)
            }
            else {
                res.send("user Deleted Successfully")
            }
        })
    }

}


module.exports={get_user,get_user_by_id,create_user,update_user,delete_user}