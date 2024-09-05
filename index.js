const express = require("express");
const mongoose = require('mongoose');
const cors = require("cors");
const cusineaiModel = require('./models/cusineai');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const app = express();
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json());

mongoose.connect("mongodb://localhost:27017/cusineai", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.json("The token was not available");
    } else {
        jwt.verify(token, "jwt-secret-key", (err, decoded) => {
            if (err) return res.json("Token is wrong");
            next();
        });
    }
};

app.get('/home', verifyUser, (req, res) => {
    return res.json("success");
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    cusineaiModel.findOne({ email: email })
        .then(user => {
            if (user) {
                bcrypt.compare(password, user.password, (err, response) => {
                    if (response) {
                        const token = jwt.sign({ email: user.email }, "jwt-secret-key", { expiresIn: "1d" });
                        res.cookie("token", token);
                        res.json("success");
                    } else {
                        res.json("incorrect password");
                    }
                });
            } else {
                res.json("no user data found");
            }
        })
        .catch(err => res.json(err));
});

app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    bcrypt.hash(password, 10)
        .then(hash => {
            cusineaiModel.create({ name, email, password: hash })
                .then(user => res.json(user))
                .catch(err => res.json(err));
        }).catch(err => console.log(err.message));
});

app.post('/check-email', (req, res) => {
    const { email } = req.body;
    cusineaiModel.findOne({ email: email })
        .then(user => {
            if (user) {
                res.json("Email already exists");
            } else {
                res.json("Email available");
            }
        })
        .catch(err => res.json(err));
});

app.post('/generate-recipe', async (req, res) => {
    const { ingredients, cuisine } = req.body;
    const prompt = `Generate a recipe with the following ingredients: ${ingredients.join(', ')} in the cuisine ${cuisine}`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;

        const text = await response.text();
        const [recipeTitle, ...recipeBody] = text.split("\n").filter(line => line.trim() !== "");
        const formattedRecipe = recipeBody.join("\n").trim();

        res.json({ recipeTitle, formattedRecipe });
    } catch (error) {
        console.error("Error generating recipe:", error);
        res.status(500).send("Error generating recipe");
    }
});

app.post('/generate-nutritional-info', async (req, res) => {
    const { dishName } = req.body;
    const prompt = `Generate detailed nutritional information for the dish "${dishName}". Provide the nutritional values for 100 grams of the dish. The information should include:
    - Calories
    - Protein
    - Fat
    - Carbohydrates
    - Fiber

    Present the information in the following format:

    **Dish Name: ${dishName}**

    **Nutritional Information (per 100 grams):**
    - **Calories:** [value] kcal
    - **Protein:** [value] g
    - **Fat:** [value] g
    - **Carbohydrates:** [value] g
    - **Fiber:** [value] g

    Ensure the output is clear, concise, and easy to read.`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;

        const text = await response.text();
        res.json({ nutritionalInfo: text });
    } catch (error) {
        console.error('Error generating nutritional information:', error);
        res.status(500).send('Error generating nutritional information');
    }
});


app.listen(3001, () => {
    console.log("Server is running on port 3001");
});
