<template>
    <svg class="orbit-artwork" viewBox="0 0 600 540" fill="none" aria-hidden="true">
        <defs>
            <radialGradient id="planet" cx="0.28" cy="0.2" r="0.9">
                <stop stop-color="#b6e5d7" />
                <stop offset="0.35" stop-color="#479681" />
                <stop offset="0.72" stop-color="#1e4d47" />
                <stop offset="1" stop-color="#122d30" />
            </radialGradient>
            <linearGradient id="orbit" x1="70" y1="400" x2="510" y2="160" gradientUnits="userSpaceOnUse">
                <stop stop-color="#88cdb8" stop-opacity="0.1" />
                <stop offset="0.5" stop-color="#c5edde" stop-opacity="0.8" />
                <stop offset="1" stop-color="#88cdb8" stop-opacity="0.1" />
            </linearGradient>
        </defs>
        <circle cx="300" cy="270" r="234" stroke="#a9d0c3" stroke-opacity="0.09" />
        <circle cx="300" cy="270" r="185" stroke="#a9d0c3" stroke-opacity="0.1" stroke-dasharray="2 10" />
        <path d="M300 20V72M300 468V520M50 270H100M500 270H550" stroke="#a9d0c3" stroke-opacity="0.3" />
        <ellipse cx="300" cy="270" rx="252" ry="81" transform="rotate(-28 300 270)" stroke="url(#orbit)" />
        <circle cx="300" cy="270" r="117" fill="url(#planet)" />
        <path d="M196 216C236 242 311 163 397 215M184 268C250 294 351 214 415 251M197 325C267 348 339 285 410 298" stroke="#c7eee0" stroke-opacity="0.12" stroke-width="14" />
        <path d="M82 370C91 411 211 381 341 312C470 243 549 163 520 146" stroke="url(#orbit)" stroke-width="2" />
        <circle cx="476" cy="181" r="7" fill="#dcefe7" />
        <circle cx="111" cy="363" r="4" fill="#7bbba5" />
        <circle cx="429" cy="73" r="2" fill="#a9d0c3" />
        <circle cx="118" cy="127" r="2" fill="#a9d0c3" />
        <circle cx="492" cy="419" r="2" fill="#a9d0c3" />
        <path d="M108 180H159M134 155V206M432 398H454M443 387V409" stroke="#a9d0c3" stroke-opacity="0.3" />
    </svg>
</template>
