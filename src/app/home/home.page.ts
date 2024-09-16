import { Component, ElementRef, ViewChild } from '@angular/core';
import { TelloService } from '../services/udp.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  ctx!: CanvasRenderingContext2D;
  gridSize = 10;
  cellSize = 30;
  grid: string[][] = [];
  start: { i: number, j: number } | null = null;
  end: { i: number, j: number } | null = null;
  executingCommands = false;
  waypoints: { points: { i: number, j: number }[] }[] = []; // Array untuk menyimpan waypoint

  constructor(private telloService: TelloService) {}

  ngOnInit() {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    this.initializeGrid();
    this.drawGrid();
  }

  initializeGrid() {
    this.grid = [];
    for (let i = 0; i < this.gridSize; i++) {
      this.grid[i] = [];
      for (let j = 0; j < this.gridSize; j++) {
        this.grid[i][j] = ''; // Set awal warna kotak menjadi kosong
      }
    }
  }

  drawGrid() {
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        this.ctx.fillStyle = this.grid[i][j] ? this.grid[i][j] : 'white';
        this.ctx.fillRect(i * this.cellSize, j * this.cellSize, this.cellSize, this.cellSize);
        this.ctx.strokeRect(i * this.cellSize, j * this.cellSize, this.cellSize, this.cellSize);
      }
    }
  }

  handleCanvasClick(event: MouseEvent) {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const i = Math.floor(x / this.cellSize);
    const j = Math.floor(y / this.cellSize);

    if (this.grid[i][j] === 'green') {
      return;
    }

    if (this.start === null) {
      this.start = { i, j };
      this.grid[i][j] = 'yellow';
    } else {
      this.end = { i, j };
      this.blockPath();
      this.start = this.end;
    }

    this.drawGrid();
  }

  blockPath() {
    if (this.start && this.end) {
      let { i: x0, j: y0 } = this.start;
      const { i: x1, j: y1 } = this.end;

      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (!(x0 === x1 && y0 === y1)) {
        this.grid[x0][y0] = 'green';
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
      this.grid[x1][y1] = 'green';
    }
  }

  saveWaypoint() {
    // Simpan waypoint baru berdasarkan jalur yang telah dipilih
    const newWaypoint = { points: [] as { i: number, j: number }[] };
    
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        if (this.grid[i][j] === 'green' || this.grid[i][j] === 'yellow') {
          newWaypoint.points.push({ i, j });
        }
      }
    }
    
    // Hanya simpan waypoint jika ada titik yang dipilih
    if (newWaypoint.points.length > 0) {
      this.waypoints.push(newWaypoint);
      this.resetGrid(); // Reset grid setelah menyimpan
    }
  }

  resetGrid() {
    this.start = null;
    this.end = null;
    this.initializeGrid(); // Reset semua grid ke kondisi awal
    this.drawGrid();
  }

  executeCommands() {
    if (this.executingCommands || this.waypoints.length === 0) {
      return;
    }

    this.executingCommands = true;
    for (const waypoint of this.waypoints) {
      const commands = this.generateCommandsFromWaypoint(waypoint);
      for (const command of commands) {
        this.telloService.sendCommand(command);
      }
    }
    
    this.executingCommands = false;
    this.waypoints = []; // Kosongkan waypoint setelah eksekusi
  }

  generateCommandsFromWaypoint(waypoint: { points: { i: number, j: number }[] }): string[] {
    const commands: string[] = [];
    const points = waypoint.points;

    for (let k = 0; k < points.length - 1; k++) {
      const { i: x0, j: y0 } = points[k];
      const { i: x1, j: y1 } = points[k + 1];

      const dx = x1 - x0;
      const dy = y1 - y0;

      if (dx === 0 && dy > 0) {
        commands.push(`forward ${dy * 100}`);
      } else if (dx === 0 && dy < 0) {
        commands.push(`backward ${Math.abs(dy) * 100}`);
      } else if (dy === 0 && dx > 0) {
        commands.push(`right ${dx * 100}`);
      } else if (dy === 0 && dx < 0) {
        commands.push(`left ${Math.abs(dx) * 100}`);
      } else if (dx > 0 && dy > 0) {
        commands.push(`NE ${Math.min(dx, dy) * 100}`);
      } else if (dx > 0 && dy < 0) {
        commands.push(`SE ${Math.min(dx, Math.abs(dy)) * 100}`);
      } else if (dx < 0 && dy > 0) {
        commands.push(`NW ${Math.min(Math.abs(dx), dy) * 100}`);
      } else if (dx < 0 && dy < 0) {
        commands.push(`SW ${Math.min(Math.abs(dx), Math.abs(dy)) * 100}`);
      }
    }

    return commands;
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  takeOff() {
    this.telloService.sendCommand('takeoff');
  }

  land() {
    this.telloService.sendCommand('land');
  }

  sendCommand(command: string) {
    this.telloService.sendCommand(command);
  }
}