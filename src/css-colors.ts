export const COLORS = {
    bg_color_dark:  "",
    bg_color_light: "",
    medium_color:   "",
    fg_color:       "",
    color_red:      "",
    color_purple:   "",
    color_blue:     "",
    color_cyan:     "",
    color_green:    "",
    color_yellow:   "",
};

function initColors () {
    const style = getComputedStyle(document.documentElement);
    for (const key of (Object.keys(COLORS) as (keyof typeof COLORS)[])) {
        COLORS[key] = style.getPropertyValue(`--${ key.replaceAll('_', '-') }`);
    }
}

if(document.readyState === 'loading') {
    document.addEventListener('load', initColors)
}
else {
    initColors()
}