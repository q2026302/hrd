# 15-Puzzle - Game Introduction & Guide

## Game Introduction

**15-Puzzle** (also known as **Number Sliding Puzzle** or **Gem Puzzle**) is a classic sliding puzzle game. This version features an 3x3 grid with eight numbered tiles and one empty space. The goal is simple yet challenging: slide the tiles using the empty space to arrange the numbers in order from 1 to 8.

---
**Play Demo**: [https://q2026302.github.io/hrd/hrd.html](https://q2026302.github.io/hrd/hrd.html)

---

## Features

### 🪵 Wooden Toy Aesthetic
- Realistic 3D wooden tiles with natural wood grain texture
- Recessed groove design on the board with exposed wood finish for the empty space
- Tactile feedback with a subtle pressing effect when clicking tiles

### 🖱️ Two Ways to Play
- **Drag & Drop**: Simply grab a tile and drag it into the adjacent empty space
- **Click to Move**: Click any tile next to the empty space and it slides right in

### 📊 Smart Helper Tools
- **Move History**: Track every move in real-time (e.g., 5↑, 3←)
- **Auto Solver**: Finds the shortest path to victory with one click
- **Step-by-Step Navigation**: Walk through the solution with Previous/Next buttons, or jump directly by clicking any step
- **Solvability Check**: Instantly tells you if the current puzzle can be solved

---

## Interface Overview

### Left Side - Game Board
- **3x3 Grid**: Nine cells—eight with numbered wooden tiles, one empty
- **Numbered Tiles**: Tiles 1-8 with a dimensional wood look
- **Empty Space**: Dark recessed groove (not clickable)

### Right Side - Control Panel
1. **Game Controls**
   - **Random**: Dropdown with three shuffle modes—"Fully Random", "Easy Start", or "Hard Start"
   - **Manual**: Popup to enter your own tile arrangement
   - **Solve**: Calculates and displays the optimal solution
   - **Reset**: Restores the board to its initial state

2. **Info Panel**
   - **Move History**: Shows all moves you've made
   - **Solution Steps**: Displays the optimal solution (appears after clicking Solve)

---

## How to Play

### Goal
Arrange the numbers in order from 1 to 8, with the empty space in the bottom-right corner (cell 9).

```
Solved State:
┌───┬───┬───┐
│ 1 │ 2 │ 3 │
├───┼───┼───┤
│ 4 │ 5 │ 6 │
├───┼───┼───┤
│ 7 │ 8 │   │
└───┴───┴───┘
```

### Movement Rules
- Only tiles next to the empty space can move
- A move slides a tile into the empty spot
- The empty space itself doesn't "move"—tiles move into it

### Solvability
- Not every random shuffle is solvable (about half are)
- The game automatically checks and lets you know
- If unsolvable, the Solve button will show: "Current board is unsolvable"

---

## Controls & Features

### Basic Moves
- **Drag**: Hold a tile and drag it toward the empty space
- **Click**: Just click a tile next to the empty space—it slides automatically

### Random Start
Click the **Random** button and choose:
- **Fully Random**: Complete shuffle (150 random moves)
- **Easy Start**: Only swaps tiles 7 and 8
- **Hard Start**: A preset tricky layout

### Manual Setup
1. Click **Manual** to open the setup window
2. Enter numbers 1-8 in the cells (leave blank or enter 0 for the empty space)
3. Click **Apply** to load your custom board

### Auto Solver
1. Hit **Solve** to find the optimal solution
2. Steps appear as "number + arrow" (e.g., 5↑ means tile 5 slides up)
3. Use **Previous/Next** to walk through the solution
4. Click any step to jump straight to that point in the solution

### Move History
- Shows every move at the top of the right panel
- Latest move is highlighted
- Format: tile number + direction arrow

---

## Pro Tips

1. **Watch the empty space**—it's your only way to move tiles
2. **Start with the corners**: Lock in numbers 1, 3, 7, and 8 first, then work on the middle
3. **Learn from the solver**: If you're stuck, let the computer show you the optimal path
4. **Explore freely**: Try your own moves—if you deviate from the solution, it clears automatically

---

## FAQ

**Q: Why are some random puzzles unsolvable?**
A: Sliding puzzles have mathematical parity constraints—only half of all random arrangements are solvable. The game checks this automatically and warns you.

**Q: What do the arrows in the solution mean?**
A: Each arrow shows which direction a numbered tile slides. "5↑" means tile 5 moves up one space.

**Q: How do I get back to where I started?**
A: Click **Reset** to return to the initial board state (the layout after your last random start or manual setup).

**Q: How do I enter an empty space in manual mode?**
A: Just leave the cell blank, or enter 0.

---

## About

- **Game**: 15-Puzzle / Number Sliding Puzzle
- **Version**: 1.0
- **Style**: Wooden Toy Texture
- **Brain**: A* Search Algorithm + Manhattan Distance Heuristic