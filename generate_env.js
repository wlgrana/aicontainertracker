
const fs = require('fs');
const content = `
AZURE_AI_ENDPOINT="https://aimlprojectsai.services.ai.azure.com/openai/v1/"
AZURE_AI_KEY="3t5ZRoYJl5J1GCLs60CeJhcodD6YJxVopyAfMRwdy0sDifYXGPbQJQQJ99BIACYeBjFXJ3w3AAAAACOG6pSr"
AZURE_AI_MODEL="DeepSeek-V3.2"
`.trim();

fs.writeFileSync('.env', content, 'utf8');
console.log('.env file created successfully');
