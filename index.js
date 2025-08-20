const express = require('express');
const cors = require('cors');
const app = express();

// CORS設定を適用します
app.use(cors());

// GETリクエストが来たら、簡単なメッセージを返すだけの機能
app.get('/', (req, res) => {
    console.log("GETリクエストを受け取りました！");
    res.status(200).send({
        status: "ok",
        message: "サーバーは正常に起動しており、GETリクエストに応答しました！"
    });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`サーバーがポート ${port} で起動しました。`);
});
