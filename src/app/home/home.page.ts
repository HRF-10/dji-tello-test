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
  points: { i: number, j: number }[] = []; // Array untuk menyimpan semua titik
  ripples: { x: number, y: number, radius: number, alpha: number }[] = [];  // Untuk efek gelombang
  isFlying = false; // Status apakah drone sedang terbang atau tidak
  rotationInterval: any; // Menyimpan interval rotasi

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
        const y = this.gridSize - 1 - j; // Membalik sumbu Y untuk menggambar
        this.ctx.fillStyle = this.grid[i][y] ? this.grid[i][y] : 'rgba(30, 30, 50, 0.7)';
        this.ctx.fillRect(i * this.cellSize, j * this.cellSize, this.cellSize, this.cellSize);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Putih dengan sedikit transparansi
        this.ctx.strokeRect(i * this.cellSize, j * this.cellSize, this.cellSize, this.cellSize);
      }
    }
    
    this.drawRipples();
  }

  drawRipples() {
    this.ripples.forEach((ripple, index) => {
      this.ctx.beginPath();
      this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, 2 * Math.PI);
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      ripple.radius += 2;
      ripple.alpha -= 0.02;

      if (ripple.alpha <= 0) {
        this.ripples.splice(index, 1);
      }
    });

    if (this.ripples.length > 0) {
      requestAnimationFrame(() => this.drawGrid());
    }
  }

  handleCanvasClick(event: MouseEvent) {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const i = Math.floor(x / this.cellSize);
    const j = this.gridSize - 1 - Math.floor(y / this.cellSize);

    if (i >= this.gridSize || j >= this.gridSize || i < 0 || j < 0) {
      return;
    }

    this.ripples.push({ x, y, radius: 0, alpha: 1 });
    this.points.push({ i, j });

    if (this.points.length === 1) {
      this.grid[i][j] = 'cyan'; // Titik pertama menggunakan cyan
    } else {
      this.grid[i][j] = 'lightgreen'; // Titik selanjutnya menggunakan light green
      this.blockPath(this.points[this.points.length - 2], this.points[this.points.length - 1]);
    }

    this.drawGrid();
  }

  blockPath(start: { i: number, j: number }, end: { i: number, j: number }) {
    let { i: x0, j: y0 } = start;
    const { i: x1, j: y1 } = end;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (!(x0 === x1 && y0 === y1)) {
      this.grid[x0][y0] = 'yellow'; // Warna jalur yang terhubung menggunakan yellow
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    this.grid[x1][y1] = 'yellow'; // Warna titik akhir menggunakan yellow
  }

  async executeCommands() {
    if (!this.isFlying) {
        console.error('Drone belum terbang. Silakan tekan tombol takeoff terlebih dahulu.');
        return;
    }

    if (this.points.length < 2) {
        console.error('Minimal dua titik diperlukan untuk mengeksekusi perintah.');
        return;
    }

    for (let i = 0; i < this.points.length - 1; i++) {
        const commands = await this.generateCommandsFromStartEnd(this.points[i], this.points[i + 1]);
        for (const command of commands) {
            await this.sendCommandWithDelay(command);
        }
    }

    this.resetGrid();
  }


  async sendCommandWithDelay(command: string) {
    console.log(`Mengirim perintah: ${command}`);
    this.telloService.sendCommand(command);
    await this.delay(1000); // Jeda 1 detik sebelum mengirim perintah berikutnya
  }
  
  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateCommandsFromStartEnd(start: { i: number, j: number }, end: { i: number, j: number }): Promise<string[]> {
    const commands: string[] = [];
    const { i: x0, j: y0 } = start;
    const { i: x1, j: y1 } = end;

    const dx = x1 - x0;
    const dy = y1 - y0;

    const maxDistance = 500; // Batas maksimum jarak per perintah adalah 500 cm
    const distancePerStep = 100; // Jarak tiap langkah dalam grid (dalam cm)
    const diagonalSpeed = 50; // Kecepatan untuk gerakan serong dalam cm/s

    const moveDrone = (command: string, distance: number) => {
        while (distance > 0) {
            const step = Math.min(distance, maxDistance);
            commands.push(`${command} ${step}`);
            distance -= step;
        }
    };

    if (dx === 0 && dy > 0) {
        // Maju
        moveDrone('forward', dy * distancePerStep);
    } else if (dx === 0 && dy < 0) {
        // Mundur
        moveDrone('back', Math.abs(dy) * distancePerStep);
    } else if (dy === 0 && dx > 0) {
        // Kanan
        moveDrone('right', dx * distancePerStep);
    } else if (dy === 0 && dx < 0) {
        // Kiri
        moveDrone('left', Math.abs(dx) * distancePerStep);
    } else {
        // Gerakan diagonal
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const distance = Math.sqrt(absDx * absDx + absDy * absDy) * distancePerStep; // Menghitung jarak diagonal
        const duration = (distance / diagonalSpeed) * 1000; // Menghitung durasi gerakan dalam milidetik
        
        // Gunakan rc command untuk gerakan diagonal dengan durasi yang sesuai
        const directionX = dx > 0 ? diagonalSpeed : -diagonalSpeed; // Kecepatan kanan/kiri
        const directionY = dy > 0 ? diagonalSpeed : -diagonalSpeed; // Kecepatan depan/belakang

        commands.push(`rc ${directionX} ${directionY} 0 0`);
        await this.delay(duration);
        commands.push('rc 0 0 0 0'); // Hentikan gerakan setelah durasi berakhir
    }

    return commands;
  }

  resetGrid() {
    this.points = [];
    this.initializeGrid();
    this.drawGrid();
  }

  async takeOff() {
    this.telloService.sendCommand('takeoff');
    this.isFlying = true;
  }

  startRotateDrone() {
    this.rotationInterval = setInterval(() => {
      console.log('Drone berputar secara clockwise.');
      this.sendCommand('rc 0 0 0 50'); // 50 adalah kecepatan yawing ke kanan
    }, 100); // Mengirim perintah setiap 100 milidetik untuk respon cepat
  }

  stopRotateDrone() {
    // Hentikan perintah rotasi saat tombol dilepas
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
      console.log('Rotasi drone dihentikan.');
      this.sendCommand('rc 0 0 0 0'); // Hentikan semua gerakan saat tombol dilepas
    }
  }

  land() {
    if (!this.isFlying) {
      console.log('Drone belum terbang.');
      return;
    }
  
    this.telloService.sendCommand('land');
    this.isFlying = false;
  
    this.reinitializeDrone();
  }
  
  reinitializeDrone() {
    console.log('Menginisialisasi ulang drone setelah landing...');
    this.telloService.sendCommand('command');
  }

  sendCommand(command: string) {
    this.telloService.sendCommand(command);
  }
}