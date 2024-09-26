import { Component, ElementRef, ViewChild } from '@angular/core';
import { TelloService } from '../services/udp.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  @ViewChild('droneCanvas', { static: false }) droneCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('droneCanvas2', { static: false }) droneCanvas2!: ElementRef<HTMLCanvasElement>;
  ctxDroneCanvas!: CanvasRenderingContext2D;
  ctxDroneCanvas2!: CanvasRenderingContext2D;
  gridSize = 10;
  cellSize = 30;
  grid: string[][] = [];
  points: { i: number, j: number }[] = []; // Array untuk menyimpan semua titik
  ripples: { x: number, y: number, radius: number, alpha: number }[] = [];  // Untuk efek gelombang
  isFlying = false; // Status apakah drone sedang terbang atau tidak
  rotationInterval: any; // Menyimpan interval rotasi

  constructor(private telloService: TelloService) {}

  ngAfterViewInit() {
    // Dapatkan konteks dari masing-masing kanvas
    this.ctxDroneCanvas = this.droneCanvas.nativeElement.getContext('2d')!;
    this.ctxDroneCanvas2 = this.droneCanvas2.nativeElement.getContext('2d')!;

    this.initializeGrid();
    
    // Panggil fungsi untuk menggambar grid di masing-masing kanvas
    this.drawGridForDroneCanvas();
    this.drawGridForDroneCanvas2();
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

  drawGridForDroneCanvas() {
    this.ctxDroneCanvas.clearRect(0, 0, this.droneCanvas.nativeElement.width, this.droneCanvas.nativeElement.height);
    
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        const y = this.gridSize - 1 - j; // Membalik sumbu Y untuk menggambar

        this.ctxDroneCanvas.fillStyle = this.grid[i][y] ? this.grid[i][y] : 'rgba(255, 255, 255, 0.1)'; // Warna transparan

        this.ctxDroneCanvas.fillRect(i * this.cellSize, j * this.cellSize, this.cellSize, this.cellSize);

        this.ctxDroneCanvas.strokeStyle = 'rgba(255, 255, 255, 1)'; // Putih tanpa transparansi
        this.ctxDroneCanvas.lineWidth = 1; // Atur lebar garis jika perlu
        this.ctxDroneCanvas.strokeRect(i * this.cellSize, j * this.cellSize, this.cellSize, this.cellSize);
      }
    }
    
    // Gambar efek gelombang (ripple)
    this.drawRipples();
  }
  
  
  // Fungsi menggambar grid untuk droneCanvas2 (kanvas latar belakang)
  drawGridForDroneCanvas2() {
    this.ctxDroneCanvas2.clearRect(0, 0, this.droneCanvas2.nativeElement.width, this.droneCanvas2.nativeElement.height);
    
    // Contoh efek yang berbeda di kanvas latar belakang
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        // Gambar efek yang diinginkan, misalnya warna dengan sedikit transparansi
        this.ctxDroneCanvas2.fillStyle = 'rgba(15, 15, 25, 1)';
        this.ctxDroneCanvas2.fillRect(i * this.cellSize, j * this.cellSize, this.cellSize, this.cellSize);
      }
    }
  
    this.drawRipples();
  }

  drawRipples() {
    this.ripples.forEach((ripple, index) => {
      this.ctxDroneCanvas.beginPath();
      this.ctxDroneCanvas.arc(ripple.x, ripple.y, ripple.radius, 0, 2 * Math.PI);
      this.ctxDroneCanvas.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha})`;
      this.ctxDroneCanvas.lineWidth = 2;
      this.ctxDroneCanvas.stroke();
      ripple.radius += 2;
      ripple.alpha -= 0.02;

      if (ripple.alpha <= 0) {
        this.ripples.splice(index, 1);
      }
    });

    if (this.ripples.length > 0) {
      requestAnimationFrame(() => this.drawGridForDroneCanvas());
    }
  }

  handleCanvasClick(event: MouseEvent) {
    const rect = this.droneCanvas.nativeElement.getBoundingClientRect(); // Ganti canvas dengan droneCanvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const i = Math.floor(x / this.cellSize);
    const j = this.gridSize - 1 - Math.floor(y / this.cellSize);
  
    if (i >= this.gridSize || j >= this.gridSize || i < 0 || j < 0) {
      return;
    }
  
    // Tambahkan ripple di titik sentuh
    this.ripples.push({ x, y, radius: 0, alpha: 1 });
  
    this.points.push({ i, j });
  
    // Tandai titik pertama dengan warna hitam, titik lainnya hijau
    if (this.points.length === 1) {
      this.grid[i][j] = 'black';
    } else {
      this.grid[i][j] = 'green';
    }
  
    // Sambungkan titik-titik jika lebih dari satu titik
    if (this.points.length > 1) {
      const lastPoint = this.points[this.points.length - 2];
      this.blockPath(lastPoint, this.points[this.points.length - 1]);
    }
  
    this.drawGridForDroneCanvas();
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
      this.grid[x0][y0] = 'rgb(17, 4, 88)'; // Warna jalur yang terhubung menggunakan yellow
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    this.grid[x1][y1] = 'rgb(17, 4, 88)'; // Warna titik akhir menggunakan yellow
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
    this.drawGridForDroneCanvas();
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