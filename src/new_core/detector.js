export function detectSite() {
    const currentURL = document.URL;
    let site = '뉴토끼'; // Default
    let protocolDomain = 'https://newtoki350.com'; // Default fallback

    if (currentURL.match(/^https:\/\/booktoki[0-9]+.com\/novel\/[0-9]+/)) {
        site = "북토끼"; 
        protocolDomain = currentURL.match(/^https:\/\/booktoki[0-9]+.com/)[0];
    }
    else if (currentURL.match(/^https:\/\/newtoki[0-9]+.com\/webtoon\/[0-9]+/)) {
        site = "뉴토끼"; 
        protocolDomain = currentURL.match(/^https:\/\/newtoki[0-9]+.com/)[0];
    }
    else if (currentURL.match(/^https:\/\/manatoki[0-9]+.net\/comic\/[0-9]+/)) {
        site = "마나토끼"; 
        protocolDomain = currentURL.match(/^https:\/\/manatoki[0-9]+.net/)[0];
    }
    else {
        return null; // Not a valid target page
    }

    return { site, protocolDomain };
}
