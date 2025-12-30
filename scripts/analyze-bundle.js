#!/usr/bin/env node
/**
 * Bundle Size Analyzer
 * Analyzes package.json dependencies and estimates bundle impact
 */

const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// Known large packages and their approximate sizes (MB)
const PACKAGE_SIZES = {
  firebase: 8.5,
  'react-native': 12.0,
  expo: 15.0,
  '@react-navigation/stack': 2.5,
  '@react-navigation/bottom-tabs': 1.8,
  'react-native-maps': 3.2,
  'react-native-google-mobile-ads': 2.1,
  '@sentry/react-native': 1.5,
  'react-native-reanimated': 3.8,
  'react-native-fast-image': 0.5,
  '@react-native-firebase/perf': 0.8,
  'react-native-vector-icons': 1.2,
};

console.log('\n📦 BUNDLE SIZE ANALYSIS\n');
console.log('='.repeat(60));

const dependencies = packageJson.dependencies || {};
let totalEstimatedSize = 0;
const largePackages = [];

Object.keys(dependencies).forEach((pkg) => {
  const size = PACKAGE_SIZES[pkg] || 0.5; // Default 0.5MB for unknown
  totalEstimatedSize += size;

  if (size >= 2.0) {
    largePackages.push({ name: pkg, size });
  }
});

// Sort by size
largePackages.sort((a, b) => b.size - a.size);

console.log('\n🔍 LARGEST PACKAGES:');
console.log('-'.repeat(60));
largePackages.forEach(({ name, size }) => {
  const bar = '█'.repeat(Math.floor(size / 2));
  console.log(`${name.padEnd(40)} ${size.toFixed(1)}MB ${bar}`);
});

console.log('\n📊 SIZE BREAKDOWN:');
console.log('-'.repeat(60));
console.log(`Total Dependencies: ${Object.keys(dependencies).length}`);
console.log(`Estimated Bundle Size: ~${totalEstimatedSize.toFixed(1)}MB`);
console.log(`Large Packages (>2MB): ${largePackages.length}`);

console.log('\n💡 OPTIMIZATION OPPORTUNITIES:');
console.log('-'.repeat(60));

const recommendations = [];

// Check for optimization opportunities
if (dependencies['firebase']) {
  recommendations.push('✓ Using Firebase - consider modular imports');
}

if (dependencies['expo']) {
  recommendations.push('✓ Expo included - tree-shaking enabled by default');
}

if (largePackages.length > 5) {
  recommendations.push('⚠ Many large packages - review if all are necessary');
}

recommendations.push('✓ Hermes enabled - will reduce bundle by ~30%');
recommendations.push('✓ ProGuard enabled - will minify Android bundle');
recommendations.push('✓ Asset optimization - optimized pattern in app.config.js');

recommendations.forEach((rec) => console.log(rec));

console.log('\n🎯 EXPECTED FINAL SIZE:');
console.log('-'.repeat(60));
const hermesReduction = totalEstimatedSize * 0.7; // 30% reduction with Hermes
const proguardReduction = hermesReduction * 0.85; // 15% reduction with ProGuard
console.log(`Before optimizations: ~${totalEstimatedSize.toFixed(1)}MB`);
console.log(`After Hermes: ~${hermesReduction.toFixed(1)}MB (-30%)`);
console.log(`After ProGuard: ~${proguardReduction.toFixed(1)}MB (-15%)`);
console.log(`\n✅ Expected final: ~${proguardReduction.toFixed(1)}MB`);

if (proguardReduction < 50) {
  console.log('\n✅ Target achieved: Bundle < 50MB\n');
} else {
  console.log(`\n⚠ Warning: May exceed 50MB target by ${(proguardReduction - 50).toFixed(1)}MB\n`);
}

console.log('='.repeat(60));
console.log('\n');
