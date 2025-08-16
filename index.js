const fetch = require('node-fetch');

// ★★★★★ ここに、あなたの情報を設定してください ★★★★★ ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Googleのサーバーから鍵を読み込む指示

// ★★★★★ ここに、あなたのConfigシートの公開URLを設定してください ★★★★★
const CONFIG_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTcQPcqxP_kBk2hRewVCihac1ES891HEH_WwJyBDzcvMM0Q37xPz63b6XbKTWO1WuaG93D1J5FIkKV/pub?gid=0&single=true&output=csv';

let brainDirectory = null;

// 事前に目次を読み込む関数
async function loadDirectory() {
    if (brainDirectory) return brainDirectory;
    try {
        const response = await fetch(CONFIG_SHEET_URL);
        if (!response.ok) throw new Error('Configシートの読み込みに失敗');
        const csvText = await response.text();
        const lines = csvText.trim().split(/\r?\n/);
        const directory = {};
        lines.slice(1).forEach(line => {
            const [key, url] = line.split(',');
            if (key && url) directory[key.trim()] = url.trim().replace(/^"|"$/g, '');
        });
        brainDirectory = directory;
        return brainDirectory;
    } catch (error) {
        console.error("目次の読み込みエラー:", error);
        return null;
    }
}

// メインの処理
exports.handleRequest = async (req, res) => {
    // CORSヘッダーを設定 (ブラウザからのアクセスを許可するため)
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    try {
        const { charaName, charaCategories, folderName, userName, userProfileMessage, operatorTalkMemo, chatHistory } = req.body;

        // 1. 目次を読み込む
        const directory = await loadDirectory();
        if (!directory) throw new Error("目次(Configシート)の読み込みに失敗しました。URLを確認してください。");

        // 2. 最適な脳を探す
        let brainUrl = null;
        if (charaName && directory[charaName]) {
            brainUrl = directory[charaName];
        } else if (charaCategories) {
            for (const category of charaCategories) {
                if (directory[category]) {
                    brainUrl = directory[category];
                    break;
                }
            }
        }
        if (!brainUrl) throw new Error(`Configシートに '${charaName}' またはそのカテゴリーに一致する脳が見つかりません。`);

        // 3. 脳の教科書を読み込む
        const brainResponse = await fetch(brainUrl);
        if (!brainResponse.ok) throw new Error('脳シートの読み込みに失敗。公開URLを確認してください。');
        const brainCsvText = await brainResponse.text();
        let prompts = {};
        const lines = brainCsvText.trim().split(/\r?\n/);
        lines.slice(1).forEach(line => {
            const parts = line.split(',');
            const key = parts[0].trim();
            const value = parts.slice(1).join(',').replace(/^"|"$/g, '').replace(/""/g, '"').replace(/\\n/g, '\n');
            if (key) prompts[key.toLowerCase()] = value;
        });

        // 4. OpenAIへの指示書を作成
        const folderRuleKey = Object.keys(prompts).find(k => k.includes('フォルダのルール') && folderName.includes(k.split(' ')[1])) || '';
        const folderRule = prompts[folderRuleKey] || '（このフォルダに適用する特別ルールはありません）';
        const system_prompt = `${prompts['1. 役割定義']}\n\n**現在このユーザーは「${folderName}」にいます。次のルールを最優先で適用してください：**\n${folderRule}\n\n${prompts['2. 口調と個性']}\n${prompts['7. アダルト要素']}\n${prompts['8. 禁止事項']}\n${prompts['9. 送るべきログ']}\n${prompts['10. 作業技術']}`;
        let user_prompt = (prompts.user_prompt || '').replace('{{フォルダ名}}', folderName).replace('{{ユーザー名}}', userName).replace('{{自己PR}}', userProfileMessage).replace('{{オペレーターメモ}}', operatorTalkMemo).replace('{{会話履歴}}', chatHistory);

        // 5. OpenAI APIを呼び出す
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: system_prompt }, { role: 'user', content: user_prompt }],
                temperature: parseFloat(prompts.temperature) || 0.8
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            throw new Error(`OpenAI APIエラー: ${errorData.error.message}`);
        }

        const data = await openaiResponse.json();
        const reply = data.choices[0].message.content.trim();
        res.status(200).send({ reply: reply });

    } catch (error) {
        console.error("エラー:", error.message);
        res.status(500).send({ error: error.message });
    }
};
