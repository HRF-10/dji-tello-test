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
  isFlying = false; // Status apakah drone sedang terbang atau tidak

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
        this.ctx.fillStyle = this.grid[i][y] ? this.grid[i][y] : 'white';
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
    const j = this.gridSize - 1 - Math.floor(y / this.cellSize); // Membalik sumbu Y
  
    if (i >= this.gridSize || j >= this.gridSize || i < 0 || j < 0) {
      return; // Cegah kesalahan indeks
    }
  
    // Tambahkan titik ke array points
    this.points.push({ i, j });
  
    // Tandai titik pertama dengan warna kuning, titik lainnya dengan hijau
    if (this.points.length === 1) {
      this.grid[i][j] = 'yellow'; // Titik awal berwarna kuning
    } else {
      this.grid[i][j] = 'green'; // Titik selanjutnya berwarna hijau
    }
  
    // Jika lebih dari satu titik, sambungkan titik-titik tersebut
    if (this.points.length > 1) {
      const lastPoint = this.points[this.points.length - 2]; // Ambil titik sebelumnya
      this.blockPath(lastPoint, this.points[this.points.length - 1]);
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
      this.grid[x0][y0] = 'green'; // Warna hijau untuk jalur yang terhubung
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }

    this.grid[x1][y1] = 'green'; // Warna hijau untuk titik akhir
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
      const commands = this.generateCommandsFromStartEnd(this.points[i], this.points[i + 1]);
      for (const command of commands) {
        await this.sendCommandWithDelay(command);
      }
    }
  
    this.resetGrid();
  }

  async sendCommandWithDelay(command: string) {
    console.log(`Mengirim perintah: ${command}`);
    this.telloService.sendCommand(command);
    
    // Jeda 1 detik sebelum mengirim perintah berikutnya
    await this.delay(1000);
  }
  
  // Fungsi delay
  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateCommandsFromStartEnd(start: { i: number, j: number }, end: { i: number, j: number }): string[] {
    const commands: string[] = [];
    const { i: x0, j: y0 } = start;
    const { i: x1, j: y1 } = end;
  
    const dx = x1 - x0;
    const dy = y1 - y0;
  
    const maxDistance = 500; // Batas maksimum jarak per perintah adalah 500 cm
    const distancePerStep = 100; // Jarak tiap langkah dalam grid (dalam cm)
  
    const moveDrone = (command: string, distance: number) => {
      while (distance > 0) {
        const step = Math.min(distance, maxDistance);
        commands.push(`${command} ${step}`);
        distance -= step;
      }
    };
  
    const moveDiagonally = (commandX: string, commandY: string, dx: number, dy: number) => {
      const totalDistance = Math.sqrt(dx * dx + dy * dy) * distancePerStep; // Jarak diagonal total
      let remainingDistance = totalDistance;
  
      // Menjalankan drone dalam langkah-langkah kecil untuk mencapai diagonal
      while (remainingDistance > 0) {
        const stepDistance = Math.min(remainingDistance, maxDistance);
        const stepX = (dx / Math.sqrt(dx * dx + dy * dy)) * stepDistance; // Komponen X untuk langkah
        const stepY = (dy / Math.sqrt(dx * dx + dy * dy)) * stepDistance;
        
        commands.push(`${commandX} ${Math.abs(Math.round(stepX))}`);
        commands.push(`${commandY} ${Math.abs(Math.round(stepY))}`);
        
        remainingDistance -= stepDistance;
      }
    };
  
    // Menghitung pergerakan ke arah yang benar
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
    } else if (dx > 0 && dy > 0) {
      // Serong kanan atas (NE)
      moveDiagonally('right', 'forward', dx, dy);
    } else if (dx > 0 && dy < 0) {
      // Serong kanan bawah (SE)
      moveDiagonally('right', 'back', dx, Math.abs(dy));
    } else if (dx < 0 && dy > 0) {
      // Serong kiri atas (NW)
      moveDiagonally('left', 'forward', Math.abs(dx), dy);
    } else if (dx < 0 && dy < 0) {
      // Serong kiri bawah (SW)
      moveDiagonally('left', 'back', Math.abs(dx), Math.abs(dy));
    }
  
    return commands;
  }    

  resetGrid() {
    this.points = [];
    this.initializeGrid();
    this.drawGrid();
  }

  takeOff() {
    if (this.isFlying) {
      console.log('Drone sudah terbang.');
      return;
    }

    this.telloService.sendCommand('takeoff');
    this.isFlying = true;
  }

  land() {
    if (!this.isFlying) {
      console.log('Drone belum terbang.');
      return;
    }
  
    this.telloService.sendCommand('land');
    this.isFlying = false;
  
    // Inisialisasi ulang setelah landing
    this.reinitializeDrone();
  }
  
  reinitializeDrone() {
    console.log('Menginisialisasi ulang drone setelah landing...');
    this.telloService.sendCommand('command'); // Kirim perintah untuk inisialisasi ulang
  }

  sendCommand(command: string) {
    this.telloService.sendCommand(command);
  }
}