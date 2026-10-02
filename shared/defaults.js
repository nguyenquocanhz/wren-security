/* Wren Security — danh sách tham số theo dõi MẶC ĐỊNH (nguồn dùng chung)
 * Dùng được ở 3 nơi: service worker (importScripts), content script, và trang web (popup/options).
 */
(function (scope) {
  scope.WREN_DEFAULT_PARAMS = [
    // Facebook / Meta
    "fbclid", "mibextid", "rdid", "fb_action_ids", "fb_action_types", "fb_source", "fb_ref", "fbadid", "ref_src", "ref_url",
    // UTM (chiến dịch quảng cáo)
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "utm_name", "utm_cid", "utm_reader", "utm_referrer", "utm_social", "utm_social_type",
    // Google
    "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "gad_source",
    // Mạng khác
    "msclkid", "mc_cid", "mc_eid", "yclid", "_openstat", "igshid", "igsh", "ttclid", "twclid",
    "_hsenc", "_hsmi", "hsCtaTracking", "vero_id", "oly_enc_id", "oly_anon_id", "wickedid"
  ];
})(typeof self !== 'undefined' ? self : this);
