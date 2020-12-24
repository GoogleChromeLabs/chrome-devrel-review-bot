const axios = require('axios');
const helpers = require('./helpers.js');
const descriptions = require('./descriptions.json');

const handlers = {
  "efficient-animated-content": data => {
    const files = [];
    if (data.score !== 1) {
      data.details.items.forEach(item => {
        files.push(helpers.filename(item.url));
      });
    }
    return {files};
  },
  // TODO(kaycebasques): File a feature request on the Lighthouse team to provide URLs
  // like efficient-animated-content does.
  "image-alt": data => {
    const files = [];
    data.details.items.forEach(item => {
      const snippet = item.node.snippet;
      const pattern = 'src="';
      const start = snippet.indexOf(pattern) + pattern.length;
      const end = snippet.substring(start).indexOf('"');
      const file = snippet.substring(start, start + end);
      files.push(file);
    });
    return {files};
  },
  default: data => {
    return data;
  }
};

const audit = async url => {
  const targets = [
    // 'duplicate-id-active',
    // 'offscreen-images',
    // 'dlitem',
    // 'video-caption',
    'efficient-animated-content',
    'image-alt',
    // 'uses-optimized-images',
    // 'link-name',
    // 'frame-title',
    // 'listitem',
    // 'definition-list',
    // 'uses-responsive-images'
  ];
  const target = `url=${url}`;
  const a11y = 'category=accessibility';
  const perf = 'category=performance';
  const key = `key=${process.env.PSI}`;
  const psi =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${target}&${a11y}&${perf}&${key}`;
  let response;
  try {
    response = await axios.get(psi);
  } catch (error) {
    console.error(error);
  }
  let output = {};
  const audits = response.data.lighthouseResult.audits;
  for (const audit in audits) {
    const auditData = audits[audit];
    if (targets.includes(audit)) {
      output[audit] = handlers[audit] ? handlers[audit](auditData) : handlers.default(auditData);
      // TODO(kaycebasques): Don't duplicate this for every page. Get it when generating the report.
      output[audit].description = descriptions[audit];
    }
  }
  return output;
};

module.exports = {
  audit
};