// 8色便签主题定义
const NOTE_COLORS = {
  yellow:   { bg: '#FFFACD', bgSidebar: '#F5EFB8', border: '#E8D594', text: '#333', name: 'Yellow' },
  green:    { bg: '#C7EDCC', bgSidebar: '#B5DFBC', border: '#A8D8B0', text: '#333', name: 'Green' },
  blue:     { bg: '#B5D1F7', bgSidebar: '#A0C2F0', border: '#8FB4E8', text: '#333', name: 'Blue' },
  pink:     { bg: '#F7C5D0', bgSidebar: '#F0B0BF', border: '#E8A0B0', text: '#333', name: 'Pink' },
  purple:   { bg: '#D9C5F7', bgSidebar: '#CAB0F0', border: '#BFA0E8', text: '#333', name: 'Purple' },
  white:    { bg: '#FFFFFF', bgSidebar: '#F5F5F5', border: '#D0D0D0', text: '#333', name: 'White' },
  orange:   { bg: '#FCE4B8', bgSidebar: '#F5D8A0', border: '#E8CC90', text: '#333', name: 'Orange' },
  teal:     { bg: '#B8E8E8', bgSidebar: '#A0DDDD', border: '#90D0D0', text: '#333', name: 'Teal' }
};

function getNoteColor(key) {
  return NOTE_COLORS[key] || NOTE_COLORS.yellow;
}
