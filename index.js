const express = require('express');
const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

app.get("/testdb", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 + 1 AS solution");
        res.json({ message: "Database connection successful", solution: rows[0].solution });
    } catch (error) {
        console.error("Error testing database connection:", error);
        res.status(500).json({ message: "Error testing database connection" });
    }
});

app.get("/analyze/:username", async (req, res) => {
    const { username } = req.params;
    try {
        const response = await axios.get(`https://api.github.com/users/${username}`);
        const data = response.data;

        console.log("GitHub API response:", data);

        const formatDate = (isoString) => {
            return new Date(isoString).toISOString().slice(0, 19).replace("T", " ");
        };

        const reposResponse = await axios.get(`https://api.github.com/users/${username}/repos`);
        const repos = reposResponse.data;

        let languageCount = {};
        repos.forEach(repo => {
            if (repo.language) {
                languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
            }
        });
        const topLanguages = Object.entries(languageCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang, count]) => `${lang} (${count})`)
            .join(", ") || "N/A";
        const mostStarred = repos.reduce((max, repo) =>
            repo.stargazers_count > (max?.stargazers_count || 0) ? repo : max, null);
        const mostStarredRepo = mostStarred ? `${mostStarred.name} (${mostStarred.stargazers_count}⭐)` : "N/A";

        const insights = {
            username: data.login,
            repo_count: data.public_repos,
            followers: data.followers,
            following: data.following,
            created_at: formatDate(data.created_at),
            updated_at: formatDate(data.updated_at),
            avatar_url: data.avatar_url,
            profile_url: data.html_url,
            bio: data.bio || "N/A",
            top_languages: topLanguages,
            most_starred_repo: mostStarredRepo,
        };


        await db.query(
            `INSERT INTO profiles (username, repo_count, followers, following, created_at, updated_at, avatar_url, profile_url, bio, top_languages, most_starred_repo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE repo_count=?, followers=?, following=?, updated_at=?, avatar_url=?, profile_url=?, bio=?, top_languages=?, most_starred_repo=?`,
            [insights.username,
            insights.repo_count,
            insights.followers,
            insights.following,
            insights.created_at,
            insights.updated_at,
            insights.avatar_url,
            insights.profile_url,
            insights.bio,
            insights.top_languages,
            insights.most_starred_repo,
            insights.repo_count,
            insights.followers,
            insights.following,
            insights.updated_at,
            insights.avatar_url,
            insights.profile_url,
            insights.bio,
            insights.top_languages,
            insights.most_starred_repo,
            ]
        );
        res.json({ message: "Profile analyzed and stored", insights });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch GitHub profile", details: error.message });
    }
});

app.get("/profiles", async (req, res) => {
    const [rows] = await db.query("SELECT * FROM profiles");
    res.json(rows);
});

app.get("/profiles/:username", async (req, res) => {
    const { username } = req.params;
    const [rows] = await db.query("SELECT * FROM profiles WHERE username=?", [username]);
    if (rows.length === 0) {
        return res.status(404).json({ error: "Profile not found" });
    }
    res.json(rows[0]);
});

app.listen(3000, () => console.log("Server running on ${PORT}"));