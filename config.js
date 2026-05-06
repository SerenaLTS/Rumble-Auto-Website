/**
 * CDN 配置文件
 * 在开发环境使用本地assets，在生产环境使用Cloudflare CDN
 */

const CONFIG = {
  USE_LOCAL_ASSETS: ['localhost', '127.0.0.1'].includes(window.location.hostname)
    || window.location.hostname.endsWith('.github.io'),

  // 根据环境选择CDN地址
  CDN_BASE_URL: ['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.hostname.endsWith('.github.io')
    ? '/assets' // 本地开发
    : 'https://your-cloudflare-cdn.com/assets', // 生产环境 - 改为你的Cloudflare URL

  // 资源路径映射
  ASSETS: {
    // Logo
    logo: 'logo-light.png',
    
    // 大图片
    heroTruck: 'hero-truck.png',
    truckSide: 'truck-side.png',
    truckRoad: 'truck-road.png',
    techTablet: 'tech-tablet.png',
    
    // 模型图片（AVIF格式）
    models: {
      g5s4x2Cargo: 'models/g5s-4x2-cargo-cab-chassis.avif',
      g5s6x4Cargo: 'models/g5s-6x4-cargo-cab-chassis.avif',
      g5s6x4Tipper: 'models/g5s-6x4-tipper-cab-chassis.avif',
      g5s8x4Cargo: 'models/g5s-8x4-cargo-cab-chassis.avif',
      g5s8x4Mixer: 'models/g5s-8x4-mixer-cab-chassis.avif',
      g5s8x4Tipper: 'models/g5s-8x4-tipper-cab-chassis.avif',
      g7s6x4Prime: 'models/g7s-6x4-prime-mover.avif',
      g7s6x4Tipper: 'models/g7s-6x4-tipper-cab-chassis.avif',
      g7s8x4Tipper: 'models/g7s-8x4-tipper-cab-chassis.avif',
      c9h6x4Prime: 'models/c9h-6x4-prime-mover.avif',
    },
    
    // 视频（存储在Cloudflare）
    videos: {
      sortPr: 'videos/sort-pr-video.mp4',
    },
    
    // PDF手册
    brochures: {
      sitrakOverview: 'brochures/sitrak-australia-overview.pdf',
      g5s4x2Cargo: 'brochures/g5s-4x2-cargo-cab-chassis.pdf',
      g5s6x4Cargo: 'brochures/g5s-6x4-cargo-cab-chassis.pdf',
      g5s6x4Tipper: 'brochures/g5s-6x4-tipper-cab-chassis.pdf',
      g5s8x4Cargo: 'brochures/g5s-8x4-cargo-cab-chassis.pdf',
      g5s8x4Mixer: 'brochures/g5s-8x4-mixer-cab-chassis.pdf',
      g5s8x4Tipper: 'brochures/g5s-8x4-tipper-cab-chassis.pdf',
      g7s6x4Prime: 'brochures/g7s-6x4-prime-mover.pdf',
      g7s6x4Tipper: 'brochures/g7s-6x4-tipper-cab-chassis.pdf',
      g7s8x4Tipper: 'brochures/g7s-8x4-tipper-cab-chassis.pdf',
      c9h6x4Prime: 'brochures/c9h-6x4-prime-mover.pdf',
    }
  },

  /**
   * 获取完整的资源URL
   * @param {string} path - 相对路径
   * @returns {string} 完整URL
   */
  getAssetUrl(path) {
    return `${this.CDN_BASE_URL}/${path}`;
  },

  /**
   * 动态替换页面中所有资源URL（生产环境）
   */
  replaceAssetUrls() {
    if (this.USE_LOCAL_ASSETS) {
      return; // 本地开发和GitHub Pages预览，无需替换
    }

    // 替换所有img标签的src
    document.querySelectorAll('img[src^="assets/"]').forEach(img => {
      const relativePath = img.getAttribute('src');
      img.setAttribute('src', this.getAssetUrl(relativePath));
    });

    // 替换所有链接的href（PDF、视频等）
    document.querySelectorAll('a[href^="assets/"]').forEach(link => {
      const relativePath = link.getAttribute('href');
      link.setAttribute('href', this.getAssetUrl(relativePath));
    });

    // 替换所有source标签（视频）
    document.querySelectorAll('source[src^="assets/"]').forEach(source => {
      const relativePath = source.getAttribute('src');
      source.setAttribute('src', this.getAssetUrl(relativePath));
    });
  }
};

// 页面加载时自动替换资源URL
document.addEventListener('DOMContentLoaded', () => {
  CONFIG.replaceAssetUrls();
});
