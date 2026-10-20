const { COLORS } = require('../config');

// Cached palettes only affect drawing. They never enter board/run snapshots.
const classic = Object.freeze({ ...COLORS, accent: COLORS.primaryButton, onPrimary: '#FFFFFF',
  surfaceMuted: '#F4EFE5', surfaceWarm: '#EFE7DA' });
const challenge = Object.freeze({ ...classic, background: '#E8EFFB', panel: '#FFFFFF',
  trayBackground: '#F3F6FD', traySelected: '#DAE4F8', text: '#263E6A', secondaryText: '#4D6081',
  primaryButton: '#354FBE', accent: '#354FBE', block: '#7999D9', emptyCell: '#DEE5F3',
  boardEdge: '#BECBEA', palaceLine: '#ACBCD7', energyEmptyCell: '#D9E3F6', clearGlow: '#FFF1CA' });
const ink = Object.freeze({ ...classic, background: '#E4E3DF', panel: '#FCFBF8', trayBackground: '#D8D8D3',
  traySelected: '#C3CAC4', boardEdge: '#777C76', emptyCell: '#E1E2DC', energyEmptyCell: '#C7C9C0',
  block: '#454F49', primaryButton: '#263D31', accent: '#263D31', alert: '#755C53', alertText: '#624A43',
  slab: '#AAA8A1', stone: '#646760', stoneLight: '#979A91', clearGlow: '#F5E8BB', gridLine: '#B0B2AA',
  palaceLine: '#747A70', text: '#202C24', secondaryText: '#4A5348', energy: '#B29152', energyText: '#695026',
  surfaceMuted: '#E7E7E0', surfaceWarm: '#DDDDD5' });
const neon = Object.freeze({ ...classic, background: '#111B29', panel: '#1B2A3D', trayBackground: '#22354A',
  traySelected: '#334F66', boardEdge: '#59788E', emptyCell: '#31485E', energyEmptyCell: '#425D66',
  block: '#7BCFC8', primaryButton: '#416F75', accent: '#A9E0D8', alert: '#D19B91', alertText: '#E3B9B1',
  slab: '#576279', stone: '#8891AC', stoneLight: '#B7BED0', clearGlow: '#F2E9AE', gridLine: '#5D7C91',
  palaceLine: '#668CA1', text: '#E4EFF1', secondaryText: '#B4C8D4', energy: '#E7CA84', energyText: '#F0D394',
  surfaceMuted: '#273C51', surfaceWarm: '#314457' });
const palettes = Object.freeze({ classic, ink, neon });
const gravityClassic = Object.freeze({ bg: '#FAF9F2', panel: '#FAF9F2', text: '#355849', muted: '#637464',
  block: '#7EAA91', edge: '#DCE2D2', empty: '#EDF0E3', alt: '#F6F5E9', tray: '#F0F0E7', selected: '#E2E8D7',
  piece: '#6C9B83', unavailable: '#855B47', primary: '#386551', clearGlow: '#FFF3D6',
  palaceLine: '#879C89', palaceActive: '#A18348', button: '#FFFFFF', onPrimary: '#FFFFFF' });
function gravityPalette(p) {
  return Object.freeze({ bg: p.background, panel: p.panel, text: p.text, muted: p.secondaryText,
    block: p.block, edge: p.trayBackground, empty: p.emptyCell, alt: p.panel, tray: p.trayBackground,
    selected: p.traySelected, piece: p.block, unavailable: p.alertText, primary: p.primaryButton,
    clearGlow: p.clearGlow, palaceLine: p.palaceLine, palaceActive: p.energy, button: p.panel, onPrimary: p.onPrimary });
}
const gravityPalettes = Object.freeze({ classic: gravityClassic, ink: gravityPalette(ink), neon: gravityPalette(neon) });
function idFor(state) { return state.appearancePreview || state.appearance && state.appearance.selected || 'classic'; }
function palette(id, blue = false) { return id === 'classic' && blue ? challenge : palettes[id] || classic; }
function apply(state) {
  const blue = state.screen === 'playing' ? Boolean(state.challenge) : state.homeMode === 'challenge';
  Object.assign(COLORS, palette(idFor(state), blue));
}
function gravity(id) { return gravityPalettes[id] || gravityClassic; }
function modeCard(mode, state) {
  if (idFor(state) === 'classic') return mode;
  return { ...mode, cardFill: COLORS.panel, cardStroke: COLORS.boardEdge,
    titleColor: COLORS.text, accent: COLORS.accent };
}

module.exports = { idFor, palette, apply, gravity, modeCard };
