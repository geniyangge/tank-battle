# 坦克大战 3D

基于 **Vue 3 + TypeScript + TresJS (Three.js)** 的 3D 坦克大战 H5 游戏。

## 技术栈

- Vue 3 + TypeScript
- TresJS（Vue 的声明式 Three.js 封装）
- Three.js
- Vite

## 游戏特性

- 3D 迷宫地图（20x20 网格）
- 第三人称跟随视角，鼠标拖拽旋转，滚轮缩放
- WASD 控制坦克移动，鼠标控制炮塔瞄准
- AI 敌方坦克波次生成，逐波递增难度
- A* 寻路 + 有限状态机（巡逻/追踪/攻击/规避）
- 碰撞检测（坦克-墙壁 / 坦克-坦克 / 子弹）
- 子弹池 + 爆炸特效
- 实时小地图
- HUD：血条、罗盘（车身方向指示）、波次/分数/击杀统计
- 游戏状态：进行中 / 暂停 / 波间过渡 / 游戏结束
- Web Audio API 音效（射击、爆炸）

## 操作说明

| 按键 | 功能 |
|------|------|
| W / A / S / D | 坦克前进 / 左转 / 后退 / 右转 |
| 鼠标移动 | 瞄准（炮塔跟随） |
| 鼠标左键 | 开火 |
| 鼠标滚轮 | 视角缩放 |
| Q / E | 炮塔旋转 |
| Space | 炮塔回正 |
| ESC | 暂停 / 继续 |

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173` 即可游玩。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## 项目结构

```
src/
├── main.ts                     # 应用入口
├── App.vue                     # 根组件
├── components/
│   ├── GameCanvas.vue          # 3D 场景主组件（TresCanvas）
│   ├── GameHUD.vue             # HUD 界面
│   └── Minimap.vue             # 小地图
├── composables/
│   └── useGame.ts              # 游戏主循环组合式函数
└── game/
    ├── constants.ts            # 游戏常量（迷宫数据、尺寸等）
    ├── types.ts                # 类型定义
    ├── entities/
    │   ├── Tank.ts             # 坦克基类
    │   ├── PlayerTank.ts       # 玩家坦克
    │   ├── EnemyTank.ts        # AI 坦克
    │   └── Bullet.ts           # 子弹实体
    └── systems/
        ├── InputManager.ts     # 键盘/鼠标输入
        ├── CollisionSystem.ts  # 碰撞检测
        ├── CameraController.ts # 相机控制
        ├── AudioManager.ts     # 音效
        ├── GameState.ts        # 游戏状态机
        ├── ExplosionEffect.ts  # 爆炸特效
        └── Pathfinding.ts      # A* 寻路
```
