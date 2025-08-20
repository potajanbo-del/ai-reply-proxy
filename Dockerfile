# 1. Node.jsの実行環境を準備
FROM node:20-slim

# 2. 作業場所を作成
WORKDIR /usr/src/app

# 3. 部品リストをコピー
COPY package*.json ./

# 4. 部品を取り寄せて設置
RUN npm install

# 5. 全ての設計図をコピー
COPY . .

# 6. サーバーのポートを開ける
EXPOSE 8080

# 7. サーバーを起動する
CMD [ "node", "index.js" ]
