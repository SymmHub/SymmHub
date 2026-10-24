const fs = require('fs');
const path = require('path');

const COLOR_GROUPS_DIR = __dirname;
const KLM_DIR = path.join(COLOR_GROUPS_DIR, 'klm');
const SKLM_DIR = path.join(COLOR_GROUPS_DIR, 'sklm');
const WALLPAPER_DIR = path.join(COLOR_GROUPS_DIR, 'wallpaper');

// Ensure directories exist
if (!fs.existsSync(KLM_DIR)) {
    fs.mkdirSync(KLM_DIR, { recursive: true });
}
if (!fs.existsSync(SKLM_DIR)) {
    fs.mkdirSync(SKLM_DIR, { recursive: true });
}
if (!fs.existsSync(WALLPAPER_DIR)) {
    fs.mkdirSync(WALLPAPER_DIR, { recursive: true });
}

// 1. Move any files matching sub_s*.json from color_groups/ root to color_groups/sklm/
const rootFiles = fs.readdirSync(COLOR_GROUPS_DIR);
rootFiles.forEach(file => {
    if (file.startsWith('sub_s') && file.endsWith('.json')) {
        const oldPath = path.join(COLOR_GROUPS_DIR, file);
        const newPath = path.join(SKLM_DIR, file);
        console.log(`Moving legacy file ${file} -> sklm/`);
        fs.renameSync(oldPath, newPath);
    }
});



// Helper to scan a directory and build groups.json
function buildGroupsJsonForDir(dirPath, outputName) {
    if (!fs.existsSync(dirPath)) {
        console.log(`Directory does not exist: ${dirPath}`);
        return;
    }

    const files = fs.readdirSync(dirPath);
    const groups = [];

    files.forEach(file => {
        if (file.startsWith('sub_') && file.endsWith('.json')) {
            const filePath = path.join(dirPath, file);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const parsed = JSON.parse(content);
                if (!parsed.name) {
                    throw new Error(`File ${file} is missing the "name" key`);
                }
                groups.push({
                    name: String(parsed.name),
                    file: file
                });
            } catch (e) {
                console.error(`Error reading/parsing ${file}:`, e);
            }
        }
    });

    // Smart sort numerically by the name key if it consists of space-separated numbers
    groups.sort((a, b) => {
        const na = a.name.split(/[\s_]+/).map(Number);
        const nb = b.name.split(/[\s_]+/).map(Number);
        for (let i = 0; i < Math.max(na.length, nb.length); i++) {
            const numA = isNaN(na[i]) ? 0 : na[i];
            const numB = isNaN(nb[i]) ? 0 : nb[i];
            if (numA !== numB) {
                return numA - numB;
            }
        }
        return a.name.localeCompare(b.name);
    });

    const groupsJsonPath = path.join(dirPath, outputName);
    fs.writeFileSync(groupsJsonPath, JSON.stringify({ groups }, null, 2), 'utf8');
    console.log(`Generated manifest: ${groupsJsonPath} with ${groups.length} groups.`);
}

// 2. Build groups.json for klm/
buildGroupsJsonForDir(KLM_DIR, 'groups.json');

// 3. Build groups.json for sklm/
buildGroupsJsonForDir(SKLM_DIR, 'groups.json');

// 3b. Build groups.json for wallpaper/
buildGroupsJsonForDir(WALLPAPER_DIR, 'groups.json');

// 4. Write group_types.json in color_groups/ root
const groupTypes = {
    types: [
        { id: 'klm', name: 'klm', path: 'klm/groups.json' },
        { id: '*klm', name: '*klm', path: 'sklm/groups.json' },
        { id: 'wallpaper', name: 'wallpaper', path: 'wallpaper/groups.json' }
    ]
};

const groupTypesPath = path.join(COLOR_GROUPS_DIR, 'group_types.json');
fs.writeFileSync(groupTypesPath, JSON.stringify(groupTypes, null, 2), 'utf8');
console.log(`Generated group types manifest: ${groupTypesPath}`);

