import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const webuiRoot = join(repoRoot, "static", "webui");
const indexPath = join(webuiRoot, "index.html");
const templatePath = join(webuiRoot, "index.template.html");
const pagesRoot = join(webuiRoot, "pages");
const libsRoot = join(webuiRoot, "libs");
const routeManifestPath = join(pagesRoot, "routes.json");
const datalistsPath = join(pagesRoot, "inventory-datalists.html");
const routesMarker = "<!-- WEBUI_ROUTES -->";
const datalistsMarker = "<!-- WEBUI_INVENTORY_DATALISTS -->";

const syncVendorAssets = () => {
    const copy = (source, destination) =>
        copyFileSync(join(repoRoot, "node_modules", source), join(libsRoot, destination));
    const iconFonts = join(libsRoot, "fonts");
    mkdirSync(iconFonts, { recursive: true });
    copy("bootstrap/dist/css/bootstrap.min.css", "bootstrap.min.css");
    copy("bootstrap/dist/css/bootstrap.min.css.map", "bootstrap.min.css.map");
    copy("bootstrap/dist/js/bootstrap.bundle.min.js", "bootstrap.bundle.min.js");
    copy("bootstrap/dist/js/bootstrap.bundle.min.js.map", "bootstrap.bundle.min.js.map");
    copy("bootstrap-icons/font/bootstrap-icons.min.css", "bootstrap-icons.min.css");
    copy("bootstrap-icons/font/fonts/bootstrap-icons.woff2", "fonts/bootstrap-icons.woff2");
    copy("bootstrap-icons/font/fonts/bootstrap-icons.woff", "fonts/bootstrap-icons.woff");
    copy("chart.js/dist/chart.umd.min.js", "chart.umd.min.js");
    copy("chart.js/dist/chart.umd.min.js.map", "chart.umd.min.js.map");
};

const findMatchingDivEnd = (html, start) => {
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = start;
    let depth = 0;
    for (const match of html.matchAll(tags)) {
        const tag = match[0];
        if (tag.startsWith("</")) {
            depth -= 1;
        } else if (!tag.endsWith("/>")) {
            depth += 1;
        }
        if (depth === 0) return match.index + tag.length;
    }
    throw new Error("Could not find the closing div for a WebUI route");
};

const getRouteFileName = (openingTag, index) => {
    const route = /\bdata-route\s*=\s*(["'])(.*?)\1/i.exec(openingTag)?.[2];
    if (!route) throw new Error(`Route ${index + 1} is missing data-route`);
    const firstRoute = route.split(",")[0].trim();
    const routeName = firstRoute
        .replace(/^\/webui\/?/, "")
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/-+$/, "");
    return `${routeName || "home"}.html`;
};

const applyEdits = (text, edits) => {
    for (const edit of [...edits].sort((left, right) => right.start - left.start)) {
        text = text.slice(0, edit.start) + edit.content + text.slice(edit.end);
    }
    return text;
};

const splitExistingIndex = () => {
    if (!existsSync(indexPath)) {
        throw new Error("WebUI template is missing and there is no index.html to split");
    }
    const html = readFileSync(indexPath, "utf8");
    const routeTag = /<div\b[^>]*\bdata-route\s*=\s*(["']).*?\1[^>]*>/gi;
    const routes = [];
    const edits = [];
    for (const match of html.matchAll(routeTag)) {
        const fileName = getRouteFileName(match[0], routes.length);
        if (routes.some(route => route.fileName === fileName)) {
            throw new Error(`Duplicate WebUI route fragment name: ${fileName}`);
        }
        const end = findMatchingDivEnd(html, match.index);
        routes.push({ fileName, content: html.slice(match.index, end) });
        edits.push({ start: match.index, end, content: routes.length === 1 ? routesMarker : "" });
    }
    if (routes.length === 0) throw new Error("No WebUI routes were found in index.html");

    const datalistStart = html.indexOf('<datalist id="datalist-miscitems"');
    const datalistEnd = html.indexOf('<datalist id="datalist-usernames"', datalistStart);
    if (datalistStart < 0 || datalistEnd < 0) {
        throw new Error("Could not find the inventory datalist block in index.html");
    }
    const datalistContent = html.slice(datalistStart, datalistEnd);
    edits.push({ start: datalistStart, end: datalistEnd, content: datalistsMarker });

    mkdirSync(pagesRoot, { recursive: true });
    for (const route of routes) {
        writeFileSync(join(pagesRoot, route.fileName), `${route.content.trim()}\n`);
    }
    writeFileSync(datalistsPath, `${datalistContent.trim()}\n`);
    writeFileSync(
        routeManifestPath,
        `${JSON.stringify(
            routes.map(route => route.fileName),
            null,
            4
        )}\n`
    );
    const template = applyEdits(html, edits).replace(
        /(?:\r?\n[ \t]*)+<!-- WEBUI_ROUTES -->/,
        "\n            <!-- WEBUI_ROUTES -->"
    );
    writeFileSync(templatePath, template);
};

if (!existsSync(templatePath) || !existsSync(routeManifestPath) || !existsSync(datalistsPath)) {
    splitExistingIndex();
}

const template = readFileSync(templatePath, "utf8");
const routeFiles = JSON.parse(readFileSync(routeManifestPath, "utf8"));
if (!Array.isArray(routeFiles) || routeFiles.length === 0) {
    throw new Error("WebUI route manifest must contain at least one route fragment");
}
if (template.split(routesMarker).length !== 2 || template.split(datalistsMarker).length !== 2) {
    throw new Error("WebUI template must contain exactly one route marker and one inventory datalist marker");
}

const routeHtml = routeFiles
    .map(fileName => {
        const pagePath = join(pagesRoot, fileName);
        if (!existsSync(pagePath)) throw new Error(`Missing WebUI route fragment: ${fileName}`);
        return readFileSync(pagePath, "utf8").trim();
    })
    .join("\n            ");
const datalistHtml = readFileSync(datalistsPath, "utf8").trim();
const output = template.replace(routesMarker, routeHtml).replace(datalistsMarker, `${datalistHtml}\n    `);
if (output.includes(routesMarker) || output.includes(datalistsMarker)) {
    throw new Error("WebUI output still contains an unresolved include marker");
}

writeFileSync(indexPath, output);
syncVendorAssets();
console.log(`[webui] Built index.html from ${routeFiles.length} route fragments.`);
