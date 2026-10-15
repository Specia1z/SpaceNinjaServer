import {
    dict_de,
    dict_en,
    dict_es,
    dict_fr,
    dict_it,
    dict_ja,
    dict_ko,
    dict_pl,
    dict_pt,
    dict_ru,
    dict_tc,
    dict_th,
    dict_tr,
    dict_uk,
    dict_zh
} from "warframe-public-export-plus";
import dict_en_supp from "../../static/fixed_responses/supplementalDict/en.json" with { type: "json" };
import dict_de_supp from "../../static/fixed_responses/supplementalDict/de.json" with { type: "json" };
import dict_es_supp from "../../static/fixed_responses/supplementalDict/es.json" with { type: "json" };
import dict_fr_supp from "../../static/fixed_responses/supplementalDict/fr.json" with { type: "json" };
import dict_it_supp from "../../static/fixed_responses/supplementalDict/it.json" with { type: "json" };
import dict_ja_supp from "../../static/fixed_responses/supplementalDict/ja.json" with { type: "json" };
import dict_ko_supp from "../../static/fixed_responses/supplementalDict/ko.json" with { type: "json" };
import dict_pl_supp from "../../static/fixed_responses/supplementalDict/pl.json" with { type: "json" };
import dict_pt_supp from "../../static/fixed_responses/supplementalDict/pt.json" with { type: "json" };
import dict_ru_supp from "../../static/fixed_responses/supplementalDict/ru.json" with { type: "json" };
import dict_tc_supp from "../../static/fixed_responses/supplementalDict/tc.json" with { type: "json" };
import dict_th_supp from "../../static/fixed_responses/supplementalDict/th.json" with { type: "json" };
import dict_tr_supp from "../../static/fixed_responses/supplementalDict/tr.json" with { type: "json" };
import dict_uk_supp from "../../static/fixed_responses/supplementalDict/uk.json" with { type: "json" };
import dict_zh_supp from "../../static/fixed_responses/supplementalDict/zh.json" with { type: "json" };

const dicts: Record<string, Record<string, string>> = {
    de: { ...dict_de, ...dict_de_supp },
    es: { ...dict_es, ...dict_es_supp },
    fr: { ...dict_fr, ...dict_fr_supp },
    it: { ...dict_it, ...dict_it_supp },
    ja: { ...dict_ja, ...dict_ja_supp },
    ko: { ...dict_ko, ...dict_ko_supp },
    pl: { ...dict_pl, ...dict_pl_supp },
    pt: { ...dict_pt, ...dict_pt_supp },
    ru: { ...dict_ru, ...dict_ru_supp },
    tc: { ...dict_tc, ...dict_tc_supp },
    th: { ...dict_th, ...dict_th_supp },
    tr: { ...dict_tr, ...dict_tr_supp },
    uk: { ...dict_uk, ...dict_uk_supp },
    zh: { ...dict_zh, ...dict_zh_supp },
    en: { ...dict_en, ...dict_en_supp }
} as const;

export const getDict = (lang: string): Record<string, string> => {
    return dicts[lang] ?? dicts.en;
};

export const getString = (key: string, dict: Record<string, string>): string => {
    return dict[key] ?? key;
};

export const getNormalizedString = (key: string, dict: Record<string, string>): string => {
    return getString(key, dict).replaceAll("‘", "'").replaceAll("’", "'").replaceAll("\r\n", " ");
};
