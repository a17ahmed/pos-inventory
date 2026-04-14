const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
    if (require('electron-squirrel-startup')) {
        app.quit();
    }
} catch (e) {
    // electron-squirrel-startup not available in dev
}

let mainWindow;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hiddenInset', // Mac style
        frame: process.platform === 'darwin' ? true : true,
        backgroundColor: '#f8fafc',
        show: false, // Don't show until ready
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5177');
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Sale',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('menu-action', 'new-sale');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Print Receipt',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => {
                        mainWindow?.webContents.send('menu-action', 'print');
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : [])
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'close' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About POS Desktop',
                    click: () => {
                        mainWindow?.webContents.send('menu-action', 'about');
                    }
                }
            ]
        }
    ];

    // Add Mac-specific menu items
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App ready
app.whenReady().then(() => {
    createWindow();
    createMenu();

    // macOS: re-create window when clicking dock icon
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-platform', () => {
    return process.platform;
});

// Handle print request — sends ESC/POS commands directly to thermal printer
ipcMain.handle('print-receipt', async (event, { receiptData }) => {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const os = require('os');

    let tmpFile = null;
    try {
        const {
            storeName, storeAddress, storePhone, cashierName,
            billNumber, date, customerName, customerBalance,
            items, subtotal, tax, itemDiscounts, billDiscount, total,
            paymentMethod, amountPaid, cashGiven, change, currency
        } = receiptData;

        const ESC = 0x1B;
        const GS = 0x1D;
        const W = 48; // full 80mm thermal width
        const commands = [];

        const addBytes = (...bytes) => commands.push(Buffer.from(bytes));
        const addText = (text) => commands.push(Buffer.from(text, 'utf8'));
        const feed = (n = 1) => { for (let i = 0; i < n; i++) addText('\n'); };
        const line = () => addText('-'.repeat(W) + '\n');
        const dblLine = () => addText('='.repeat(W) + '\n');
        const lr = (left, right) => {
            left = String(left); right = String(right);
            const gap = W - left.length - right.length;
            addText(left + ' '.repeat(Math.max(1, gap)) + right + '\n');
        };
        const money = (amt) => currency + ' ' + Number(amt).toLocaleString();
        const num = (n) => Number(n).toLocaleString();

        // Initialize
        addBytes(ESC, 0x40);
        feed(1);

        // ──── STORE HEADER (hardware centered) ────
        addBytes(ESC, 0x61, 1); // printer hardware center
        addBytes(ESC, 0x45, 1); // bold
        addBytes(GS, 0x21, 0x01); // double height
        addText((storeName || 'STORE').toUpperCase() + '\n');
        addBytes(GS, 0x21, 0x00); // normal
        addBytes(ESC, 0x45, 0);
        if (storeAddress) addText(storeAddress + '\n');
        if (storePhone) addText('Tel: ' + storePhone + '\n');
        feed();
        addBytes(ESC, 0x45, 1);
        addText('SALE INVOICE\n');
        addBytes(ESC, 0x45, 0);
        addBytes(ESC, 0x61, 0); // back to left align
        line();

        // ──── BILL INFO ────
        lr('Inv No: ' + billNumber, date);
        if (cashierName) lr('Cashier: ' + cashierName, '');
        if (customerName && customerName !== 'Walk-in') {
            lr('Customer: ' + customerName, '');
        }
        line();

        // ──── ITEMS TABLE ────
        // Columns: #(3) Name(16) Qty(5) Rate(7) Amt(9) Disc(8) = 48
        const c = { sr: 3, name: 16, qty: 5, rate: 7, amt: 9, disc: 8 };
        addBytes(ESC, 0x45, 1);
        addText(
            '#'.padEnd(c.sr) +
            'Item'.padEnd(c.name) +
            'Qty'.padStart(c.qty) +
            'Rate'.padStart(c.rate) +
            'Amt'.padStart(c.amt) +
            'Disc'.padStart(c.disc) + '\n'
        );
        addBytes(ESC, 0x45, 0);
        line();

        let totalQty = 0;
        let totalAmt = 0;
        let totalDisc = 0;

        items.forEach((item, i) => {
            const rate = item.rate || item.price || 0;
            const amount = item.amount || (rate * item.qty);
            const disc = Number(item.discountAmount) || 0;
            totalQty += item.qty;
            totalAmt += amount;
            totalDisc += disc;

            let name = item.name;
            if (name.length > c.name - 1) name = name.substring(0, c.name - 2) + '.';

            addText(
                String(i + 1).padEnd(c.sr) +
                name.padEnd(c.name) +
                String(item.qty).padStart(c.qty) +
                num(rate).padStart(c.rate) +
                num(amount).padStart(c.amt) +
                (disc > 0 ? ('-' + num(disc)).padStart(c.disc) : '0'.padStart(c.disc)) + '\n'
            );
        });

        line();
        // Total row
        addBytes(ESC, 0x45, 1);
        addText(
            'Total'.padEnd(c.sr + c.name) +
            String(totalQty).padStart(c.qty) +
            ''.padStart(c.rate) +
            num(totalAmt).padStart(c.amt) +
            (totalDisc > 0 ? ('-' + num(totalDisc)).padStart(c.disc) : '0'.padStart(c.disc)) + '\n'
        );
        addBytes(ESC, 0x45, 0);
        line();

        // ──── TOTALS ────
        lr('Sub Total:', money(subtotal));
        if (itemDiscounts > 0) lr('Item Discount:', '-' + money(itemDiscounts));
        if (billDiscount > 0) lr('Bill Discount:', '-' + money(billDiscount));
        if (tax > 0) lr('Tax:', money(tax));
        dblLine();

        // ──── GRAND TOTAL ────
        addBytes(ESC, 0x45, 1);
        addBytes(GS, 0x21, 0x01); // double height
        lr('Total:', money(total));
        addBytes(GS, 0x21, 0x00);
        addBytes(ESC, 0x45, 0);
        dblLine();

        // ──── PAYMENT ────
        lr('Payment:', paymentMethod.toUpperCase());
        if (paymentMethod === 'cash' && cashGiven > 0) {
            lr('Tendered:', money(cashGiven));
            lr('Change:', money(change));
        }

        // Show partial payment for credit/other methods
        const paidOnBill = amountPaid ?? 0;
        if (paymentMethod !== 'cash' && paymentMethod !== 'card' && paidOnBill > 0) {
            lr('Paid:', money(paidOnBill));
        }

        // ──── ACCOUNT BALANCE ────
        if (customerName && customerName !== 'Walk-in') {
            const billDue = Math.max(0, total - paidOnBill);
            if (billDue > 0) lr('This Bill Due:', money(billDue));
            const newBalance = (customerBalance || 0) + billDue;
            lr('Account Balance:', money(newBalance));
        }

        line();

        // ──── FOOTER ────
        addBytes(ESC, 0x61, 1); // hardware center
        addBytes(ESC, 0x45, 1);
        addText('THANK YOU!\n');
        addBytes(ESC, 0x45, 0);
        addBytes(ESC, 0x61, 0); // left
        line();
        addBytes(ESC, 0x61, 1); // hardware center
        addText('Software by Ahmed\n');
        addText('0307-0019031\n');
        addBytes(ESC, 0x61, 0); // left
        feed(3);

        // Cut paper
        addBytes(GS, 0x56, 0x42, 0x00);

        // Send to printer
        const buffer = Buffer.concat(commands);
        tmpFile = path.join(os.tmpdir(), 'receipt_' + Date.now() + '.bin');
        fs.writeFileSync(tmpFile, buffer);

        try {
            execSync(`lp -d STMicroelectronics_POS80_Printer_USB -o raw "${tmpFile}" 2>&1`, { timeout: 10000 });
        } catch (lpError) {
            const printers = execSync('lpstat -p 2>/dev/null', { timeout: 5000 }).toString();
            const posMatch = printers.match(/printer (\S*(?:POS|STM|Thermal|Receipt|Speed)\S*)/i);
            if (posMatch) {
                execSync(`lp -d "${posMatch[1]}" -o raw "${tmpFile}" 2>&1`, { timeout: 10000 });
            } else {
                throw new Error('No thermal printer found. Printers: ' + printers);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Print error:', error);
        return { success: false, error: error.message };
    } finally {
        if (tmpFile) try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
    }
});
