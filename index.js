const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// どんなリクエストが来ても、ただ「サーバーは動いています」とだけ返す
app.post('/', (req, res) => {
    console.log("リクエストを受け取りました！");
    res.status(200).send({
        status: "ok",
        message: "サーバーは正常に動いています！"
    });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`サーバーがポート ${port} で起動しました。`);
});
