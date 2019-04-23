var express = require("express");
var mongoose = require("mongoose");
var logger = require("morgan");


var cheerio = require("cheerio");
var axios = require("axios");

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 3000;
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/news-scrape";
// Connect to the Mongo DB
mongoose.connect(MONGODB_URI);

var app = express();
var exphbs = require("express-handlebars");

app.use(logger("dev"));
//Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
//Make public a static folder
app.use(express.static("public"));

//** ROUTES **//

app.get("/scrape", function(req, res) {
    axios.get("http://www.nytimes.com/").then(function(response) {
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(response.data);
        $("article.story").each(function(i, element) {

            var result = {};

            result.title = $(this)
                .children("h2.story-heading")
                .children("a")
                .text();
            result.link = $(this)
                .children("p.summary")
                .text();
            
            db.Article.findOne({title: result.title}).then(function(dbFinder) {
                if (dbFinder) {
                    return;
                } else {
                    db.Article
                        .create(result)
                        .then(function(dbArticle) {
                            res.send("Scrape Complete!");
                        })
                        .catch(function(err) {
                            res.json(err);
                        });
                }
            });
            res.redirect("/");
        });
    });
});

//get all articles
app.get("/", function(req, res) {
    db.Article.find({}).populate("comments").then(function(data) {
        res.render("index", {articles: data});
    }).catch(function (err) {
        res.json(err);
    });
});

//grab by id
app.get("/articles/:id", function(req,res) {
    db.Article.findOne({ _id: req.params.id })
        .populate("comments")
        .then(function(data) {
            res.json(data);
        }).catch(function(err) {
            res.json(err)
        });
});

//POST Routes
app.post("/articles/:id", function(req, res) {
    db.Comment.create(req.body).then(function(dbComment) {
        return db.Article.findOneAndUpdate({_id: req.params.id}, {$push: {comments: dbComment}}).then(function(dbRes) {
            res.redirect("/");
        });
    })
});

app.post("/articles/delete/:id", function (req, res) {
    db.Comment.remove({ _id: req.params.id}).then(function (dbRemove) {
        res.json(dbRemove);
    });
});

app.post("/articles/save/:id", function (req, res) {
    db.Article.findOneAndUpdate({ _id: req.params.id}, {saved: true}).then(function(dbRes) {
        res.redirect("/");
    })
})

app.post("/savedarticles", function (req, res) {
    db.Article.find({ saved: true}).populate("comments").then(function(data) {
        res.render("saved", {articles: data});
    }).catch(function(err) {
        res.json(err);
    });
});

//start the server
app.listen(PORT, function() {
    console.log("App running on port " + PORT + "!");
});