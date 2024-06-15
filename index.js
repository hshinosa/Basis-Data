const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
require('dotenv').config();
const path = require('path');

// Inisialisasi Firebase Admin SDK
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore();
const app = express();
app.use(bodyParser.json());

// Menambahkan produk
app.post('/produk', async (req, res) => {
  const { Kategori_Barang, Nama_Barang, Harga_Barang, Jumlah_Stok, Pemasok } = req.body;

  try {
    // Dapatkan ID terakhir dari data yang ada
    const lastProdukSnapshot = await db.collection('Produk').orderBy('id_Produk', 'desc').limit(1).get();
    let id = 1; // Jika tidak ada data sebelumnya, mulai dengan ID 1

    if (!lastProdukSnapshot.empty) {
      // Jika ada data sebelumnya, gunakan ID terakhir ditambah 1
      const lastProdukData = lastProdukSnapshot.docs[0].data();
      id = lastProdukData.id_Produk + 1;
    }

    // Tambahkan data produk baru ke Firestore dengan ID baru
    const newProdukRef = db.collection('Produk').doc(id.toString());

    await newProdukRef.set({
      id_Produk: id,
      Kategori_Barang,
      Nama_Barang,
      Harga_Barang,
      Jumlah_Stok,
      Pemasok,
    });

    const addMessage = `Produk baru ditambahkan dengan ID: ${id} dan Nama: ${Nama_Barang}`;
    await tambahRiwayat('Produk', id.toString(), addMessage);

    res.status(200).send('Produk baru berhasil ditambahkan');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menambah produk baru');
  }
});

// Menampilkan produk
app.get('/produk', async (req, res) => {
  try {
    const produkSnapshot = await db.collection('Produk').get();
    const produkData = [];

    produkSnapshot.forEach(doc => {
      produkData.push(doc.data());
    });

    res.status(200).json(produkData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data produk');
  }
});

// Mendapatkan produk berdasarkan id
app.get('/produk/:id', async (req, res) => {
  const produkId = req.params.id;

  try {
    const produkDoc = await db.collection('Produk').doc(produkId).get();

    if (!produkDoc.exists) {
      return res.status(404).send('Produk tidak ditemukan');
    }

    const produkData = produkDoc.data();
    res.status(200).json(produkData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data produk');
  }
});

// Mengupdate produk berdasarkan id
app.put('/produk/:id', async (req, res) => {
  const produkId = req.params.id;
  const { Kategori_Barang, Nama_Barang, Harga_Barang, Jumlah_Stok, Tanggal_Pembelian, Tanggal_Kedaluwarsa, Pemasok } = req.body;

  try {
    const produkRef = db.collection('Produk').doc(produkId);
    const produkDoc = await produkRef.get();

    if (!produkDoc.exists) {
      return res.status(404).send('Produk tidak ditemukan');
    }

    const updatedFields = {};
    if (Kategori_Barang) updatedFields.Kategori_Barang = Kategori_Barang;
    if (Nama_Barang) updatedFields.Nama_Barang = Nama_Barang;
    if (Harga_Barang) updatedFields.Harga_Barang = Harga_Barang;
    if (Jumlah_Stok) updatedFields.Jumlah_Stok = Jumlah_Stok;
    if (Pemasok) updatedFields.Pemasok = Pemasok;

    await produkRef.update(updatedFields);

    const updateMessage = `Produk dengan ID: ${produkId} diperbarui`;
    await tambahRiwayat('Produk', produkId, updateMessage);

    res.status(200).send('Produk berhasil diupdate');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengupdate produk');
  }
});

// Menghapus produk berdasarkan id
app.delete('/produk/:id', async (req, res) => {
  const produkId = req.params.id;

  try {
    const produkRef = db.collection('Produk').doc(produkId);
    const produkDoc = await produkRef.get();

    if (!produkDoc.exists) {
      return res.status(404).send('Produk tidak ditemukan');
    }

    await produkRef.delete();

    const deleteMessage = `Produk dengan ID: ${produkId} berhasil dihapus`;
    await tambahRiwayat('Produk', produkId, deleteMessage);

    res.status(200).send('Produk berhasil dihapus');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menghapus produk');
  }
});

// Membuat transaksi baru
app.post('/transaksi', async (req, res) => {
  const { id_Produk, Jumlah_Transaksi } = req.body;

  try {
    // Dapatkan ID terakhir dari data yang ada
    const lastTransaksiSnapshot = await db.collection('Transaksi').orderBy('id_Transaksi', 'desc').limit(1).get();
    let id = 1; // Jika tidak ada data sebelumnya, mulai dengan ID 1

    if (!lastTransaksiSnapshot.empty) {
      // Jika ada data sebelumnya, gunakan ID terakhir ditambah 1
      const lastTransaksiData = lastTransaksiSnapshot.docs[0].data();
      id = lastTransaksiData.id_Transaksi + 1;
    }

    const produkRef = db.collection('Produk').doc(id_Produk.toString());
    const produkDoc = await produkRef.get();

    if (!produkDoc.exists) {
      return res.status(404).send('Produk tidak ditemukan');
    }

    const produkData = produkDoc.data();
    if (produkData.Jumlah_Stok < Jumlah_Transaksi) {
      return res.status(400).send('Jumlah transaksi melebihi jumlah stok');
    }

    // Hitung Total_Harga berdasarkan Harga_Barang dari produk
    const Total_Harga = produkData.Harga_Barang * Jumlah_Transaksi;

    const newTransaksiRef = db.collection('Transaksi').doc(id.toString());
    await newTransaksiRef.set({
      id_Transaksi: id,
      id_Produk,
      Total_Harga,
      Jumlah_Transaksi,
      Tanggal_Transaksi: admin.firestore.FieldValue.serverTimestamp()
    });

    await produkRef.update({
      Jumlah_Stok: produkData.Jumlah_Stok - Jumlah_Transaksi
    });

    const addMessage = `Transaksi baru ditambahkan dengan ID: ${id}`;
    await tambahRiwayat('Transaksi', id.toString(), addMessage);

    res.status(200).send('Transaksi baru berhasil ditambahkan');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menambah transaksi baru');
  }
});

// Menampilkan semua transaksi
app.get('/transaksi', async (req, res) => {
  try {
    const transaksiSnapshot = await db.collection('Transaksi').get();
    const transaksiData = [];

    transaksiSnapshot.forEach(doc => {
      transaksiData.push(doc.data());
    });

    res.status(200).json(transaksiData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data transaksi');
  }
});

// Mendapatkan transaksi berdasarkan id
app.get('/transaksi/:id', async (req, res) => {
  const transaksiId = req.params.id;

  try {
    const transaksiDoc = await db.collection('Transaksi').doc(transaksiId).get();

    if (!transaksiDoc.exists) {
      return res.status(404).send('Transaksi tidak ditemukan');
    }

    const transaksiData = transaksiDoc.data();
    res.status(200).json(transaksiData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data transaksi');
  }
});

// Mengupdate transaksi berdasarkan id
app.put('/transaksi/:id', async (req, res) => {
  const { id } = req.params;
  const { id_Produk, Jumlah_Transaksi } = req.body;

  try {
    const transaksiRef = db.collection('Transaksi').doc(id);
    const transaksiDoc = await transaksiRef.get();

    if (!transaksiDoc.exists) {
      return res.status(404).send('Transaksi tidak ditemukan');
    }

    const transaksiData = transaksiDoc.data();
    const produkRef = db.collection('Produk').doc(transaksiData.id_Produk.toString());
    const produkDoc = await produkRef.get();

    if (!produkDoc.exists) {
      return res.status(404).send('Produk tidak ditemukan');
    }

    const produkData = produkDoc.data();
    const hargaProduk = produkData.Harga_Barang;

    // Menghitung ulang Total_Harga berdasarkan Jumlah_Transaksi baru
    const Total_Harga = Jumlah_Transaksi * hargaProduk;

    const updatedFields = {};
    if (id_Produk) updatedFields.id_Produk = id_Produk;
    if (Total_Harga) updatedFields.Total_Harga = Total_Harga;
    if (Jumlah_Transaksi) updatedFields.Jumlah_Transaksi = Jumlah_Transaksi;

    await transaksiRef.update(updatedFields);

    if (Jumlah_Transaksi) {
      await produkRef.update({
        Jumlah_Stok: produkData.Jumlah_Stok + transaksiData.Jumlah_Transaksi - Jumlah_Transaksi
      });
    }

    const addMessage = `Transaksi diupdate untuk ID: ${id}`;
    await tambahRiwayat('Transaksi', id.toString(), addMessage);

    res.status(200).send('Transaksi berhasil diupdate');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengupdate transaksi');
  }
});

// Menghapus transaksi berdasarkan id
app.delete('/transaksi/:id', async (req, res) => {
  const transaksiId = req.params.id;

  try {
    const transaksiRef = db.collection('Transaksi').doc(transaksiId);
    const transaksiDoc = await transaksiRef.get();

    if (!transaksiDoc.exists) {
      return res.status(404).send('Transaksi tidak ditemukan');
    }

    const deletedTransaksiData = transaksiDoc.id_Transaksi();

    const transaksiData = transaksiDoc.data();
    const produkRef = db.collection('Produk').doc(transaksiData.id_Produk.toString());
    const produkDoc = await produkRef.get();

    if (!produkDoc.exists) {
      return res.status(404).send('Produk tidak ditemukan');
    }

    const produkData = produkDoc.data();

    await transaksiRef.delete();

    await produkRef.update({
      Jumlah_Stok: produkData.Jumlah_Stok + transaksiData.Jumlah_Transaksi
    });


    const addMessage = `Transaksi dihapus untuk ID: `;
    await tambahRiwayat('Transaksi', id.toString(), deletedTransaksiData);

    res.status(200).send('Transaksi berhasil dihapus');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menghapus transaksi');
  }
});

// Membuat hutang baru
app.post('/hutang', async (req, res) => {
  const { id_Produk, id_Transaksi, id_Pelanggan, Jumlah_Barang, Keterangan } = req.body;

  try {
    // Dapatkan ID terakhir dari data yang ada di koleksi Hutang
    const lastHutangSnapshot = await db.collection('Hutang').orderBy('id_Hutang', 'desc').limit(1).get();
    let id = 1; // Jika tidak ada data sebelumnya, mulai dengan ID 1

    if (!lastHutangSnapshot.empty) {
      // Jika ada data sebelumnya, gunakan ID terakhir ditambah 1
      const lastHutangData = lastHutangSnapshot.docs[0].data();
      id = lastHutangData.id_Hutang + 1;
    }

    const produkRef = db.collection('Produk').doc(id_Produk.toString());
    const produkDoc = await produkRef.get();

    if (!produkDoc.exists) {
      return res.status(404).send('Produk tidak ditemukan');
    }

    const produkData = produkDoc.data();
    const hargaBarang = produkData.Harga_Barang;
    const jumlahHutang = Jumlah_Barang * hargaBarang;

    const newHutangRef = db.collection('Hutang').doc(id.toString());
    await newHutangRef.set({
      id_Hutang: id,
      id_Produk,
      id_Transaksi,
      id_Pelanggan,
      Jumlah_Barang,
      Harga_Barang: hargaBarang,
      Jumlah_Hutang: jumlahHutang,
      Status_Hutang: 'Belum Lunas',
      Keterangan,
      Tanggal_Mulai: admin.firestore.FieldValue.serverTimestamp(),
      Tanggal_Jatuh_Tempo: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) // 2 minggu dari sekarang
    });

    await tambahRiwayat('Hutang', id, `Menambahkan hutang dengan ID ${id}`);

    res.status(200).send(`Hutang berhasil ditambahkan dengan ID: ${id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menambah hutang');
  }
});



// Menampilkan semua hutang
app.get('/hutang', async (req, res) => {
  try {
    const hutangSnapshot = await db.collection('Hutang').get();
    const hutangData = [];

    hutangSnapshot.forEach(doc => {
      hutangData.push(doc.data());
    });

    res.status(200).json(hutangData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data hutang');
  }
});


// Mengupdate hutang berdasarkan id
app.put('/hutang/:id', async (req, res) => {
  const hutangId = req.params.id;
  const { Jumlah_Hutang } = req.body;

  try {
    const hutangRef = db.collection('Hutang').doc(hutangId);
    const hutangDoc = await hutangRef.get();

    if (!hutangDoc.exists) {
      return res.status(404).send('Hutang tidak ditemukan');
    }

    await db.collection('Hutang').doc(hutangId).update({
      Jumlah_Hutang,
      Status_Hutang: Jumlah_Hutang > 0 ? 'Belum Lunas' : 'Lunas',
      updated_Tanggal: admin.firestore.FieldValue.serverTimestamp()
    });

    // Memanggil stored procedure untuk mengupdate status hutang pelanggan
    await db.runTransaction(async (transaction) => {
      const hutangSnapshot = await transaction.get(hutangRef);
      const hutangData = hutangSnapshot.data();
      const pelangganRef = db.collection('Pelanggan').doc(hutangData.id_Pelanggan.toString());
      const pelangganSnapshot = await transaction.get(pelangganRef);
      const pelangganData = pelangganSnapshot.data();

      const totalHutangSnapshot = await db.collection('Hutang').where('id_Pelanggan', '==', hutangData.id_Pelanggan).get();
      let totalHutang = 0;
      totalHutangSnapshot.forEach(doc => {
        totalHutang += doc.data().Jumlah_Hutang;
      });

      if (totalHutang == 0) {
        transaction.update(pelangganRef, { Status_Pelanggan: 'Lunas' });
      }
    });

    const addMessage = `Hutang dengan ID ${hutangId} berhasil diupdate`;

    await tambahRiwayat('Hutang', hutangId, addMessage);

    res.status(200).send('Hutang berhasil diupdate');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengupdate hutang');
  }
});

// Menambah pelanggan baru
app.post('/pelanggan', async (req, res) => {
  const { Nama_Pelanggan } = req.body;

  try {
    // Dapatkan ID terakhir dari data yang ada
    const lastPelangganSnapshot = await db.collection('Pelanggan').orderBy('id_Pelanggan', 'desc').limit(1).get();
    let id = 1; // Jika tidak ada data sebelumnya, mulai dengan ID 1

    if (!lastPelangganSnapshot.empty) {
      // Jika ada data sebelumnya, gunakan ID terakhir ditambah 1
      const lastPelangganData = lastPelangganSnapshot.docs[0].data();
      id = lastPelangganData.id_Pelanggan + 1;
    }

    // Tambahkan data pelanggan baru ke Firestore dengan ID baru
    const newPelangganRef = db.collection('Pelanggan').doc(id.toString());

    await newPelangganRef.set({
      id_Pelanggan: id,
      Nama_Pelanggan: Nama_Pelanggan,
      Tanggal_Daftar: admin.firestore.FieldValue.serverTimestamp()
    });

    const addMessage = `User baru ditambahkan dengan Nama: ${Nama_Pelanggan}`;
    await tambahRiwayat('Pelanggan', id.toString(), addMessage);

    res.status(200).send('Pelanggan baru berhasil ditambahkan');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menambah pelanggan baru');
  }
});

// Mengupdate pelanggan berdasarkan ID
app.put('/pelanggan/:id', async (req, res) => {
  const pelangganId = req.params.id;
  const { Nama_Pelanggan } = req.body;

  try {
    const pelangganRef = db.collection('Pelanggan').doc(pelangganId);
    const pelangganDoc = await pelangganRef.get();

    if (!pelangganDoc.exists) {
      return res.status(404).send('Pelanggan tidak ditemukan');
    }

    const updatedFields = {};
    if (Nama_Pelanggan) {
      updatedFields.Nama_Pelanggan = Nama_Pelanggan;
    }

    await pelangganRef.update(updatedFields);

    const updateMessage = `Informasi pelanggan berhasil diupdate: Nama_Pelanggan: ${Nama_Pelanggan}`;
    await tambahRiwayat('Pelanggan', pelangganId, updateMessage);

    res.status(200).send(updateMessage);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengupdate pelanggan');
  }
});

// Menghapus pelanggan berdasarkan ID
app.delete('/pelanggan/:id', async (req, res) => {
  const pelangganId = req.params.id;

  try {
    const pelangganRef = db.collection('Pelanggan').doc(pelangganId);
    const pelangganDoc = await pelangganRef.get();

    if (!pelangganDoc.exists) {
      return res.status(404).send('Pelanggan tidak ditemukan');
    }

    const deletedPelangganData = pelangganDoc.data();

    await pelangganRef.delete();

    const deleteMessage = `Pelanggan dengan Nama ${deletedPelangganData.Nama_Pelanggan} berhasil dihapus`;
    await tambahRiwayat('Pelanggan', pelangganId, deleteMessage);

    res.status(200).send(deleteMessage);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menghapus pelanggan');
  }
});

// Menampilkan semua pelanggan
app.get('/pelanggan', async (req, res) => {
  try {
    const pelangganSnapshot = await db.collection('Pelanggan').get();
    const pelangganData = [];

    pelangganSnapshot.forEach(doc => {
      pelangganData.push(doc.data());
    });

    res.status(200).json(pelangganData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data pelanggan');
  }
});

// Mengambil nama pelanggan berdasarkan ID
app.get('/pelanggan/:id', async (req, res) => {
  const pelangganId = req.params.id;

  try {
    const pelangganDoc = await db.collection('Pelanggan').doc(pelangganId).get();

    if (!pelangganDoc.exists) {
      return res.status(404).send('Pelanggan tidak ditemukan');
    }

    const pelangganData = pelangganDoc.data();
    res.status(200).json({ id: pelangganId, Nama_Pelanggan: pelangganData.Nama_Pelanggan });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data pelanggan');
  }
});

// Fungsi untuk menambahkan entri riwayat
async function tambahRiwayat(tabel, id_Referensi, keterangan) {
  try {
    const lastRiwayatSnapshot = await db.collection('Riwayat').orderBy('id_Riwayat', 'desc').limit(1).get();
    let id_Riwayat = 1;

    if (!lastRiwayatSnapshot.empty) {
      const lastRiwayatData = lastRiwayatSnapshot.docs[0].data();
      id_Riwayat = lastRiwayatData.id_Riwayat + 1;
    }

    const riwayatRef = db.collection('Riwayat').doc(id_Riwayat.toString());

    await riwayatRef.set({
      id_Riwayat: id_Riwayat,
      Tabel: tabel,
      id_Referensi: id_Referensi,
      Keterangan: keterangan,
      Tanggal: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Riwayat baru berhasil ditambahkan');
  } catch (error) {
    console.error('Error saat menambahkan riwayat baru:', error);
  }
}

// Menampilkan semua riwayat
app.get('/riwayat', async (req, res) => {
  try {
    const riwayatSnapshot = await db.collection('Riwayat').get();
    const riwayatData = [];

    riwayatSnapshot.forEach(doc => {
      riwayatData.push(doc.data());
    });

    let htmlResponse = '<table>';
    htmlResponse += '<tr><th>Tabel</th><th>Keterangan</th><th>Tanggal</th></tr>';

    riwayatData.forEach(riwayat => {
      const date = new Date(riwayat.Tanggal.seconds * 1000);
      htmlResponse += `<tr><td>${riwayat.Tabel}</td><td>${riwayat.Keterangan}</td><td>${date.toLocaleString()}</td></tr>`;
    });

    htmlResponse += '</table>';

    res.status(200).send(htmlResponse);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data riwayat');
  }
});

// Menambah user baru
app.post('/users', async (req, res) => {
  const { Username, Password } = req.body;

  try {
    // Dapatkan ID terakhir dari data yang ada
    const lastUserSnapshot = await db.collection('Users').orderBy('id', 'desc').limit(1).get();
    let id = 1; // Jika tidak ada data sebelumnya, mulai dengan ID 1

    if (!lastUserSnapshot.empty) {
      // Jika ada data sebelumnya, gunakan ID terakhir ditambah 1
      const lastUserData = lastUserSnapshot.docs[0].data();
      id = lastUserData.id + 1;
    }

    // Tambahkan data user baru ke Firestore dengan ID baru
    const newUserRef = db.collection('Users').doc(id.toString());

    await newUserRef.set({
      id: id,
      Username: Username,
      Password: Password
    });

    const addMessage = ` User baru ditambahkan dengan Username: ${Username}, Password: ${Password}`;
    
    // Buat entri riwayat untuk menambahkan pengguna baru
    await tambahRiwayat('Users', id.toString(), addMessage);

    res.status(200).send('User baru berhasil ditambahkan');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menambah user baru');
  }
});

// Mengupdate pengguna berdasarkan ID
app.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { Username, Password } = req.body;

  try {
    const userRef = db.collection('Users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send('Pengguna tidak ditemukan');
    }

    const updatedFields = {};
    if (Username) {
      updatedFields.Username = Username;
    }
    if (Password) {
      updatedFields.Password = Password;
    }

    await userRef.update(updatedFields);

    // Mendapatkan data terbaru setelah update
    const updatedUserDoc = await userRef.get();
    const updatedUserData = updatedUserDoc.data();

    

    // Keterangan apa yang diupdate
    let updateMessage = 'Informasi pengguna berhasil diupdate:';
    if (Username) {
      updateMessage += ` Username: ${updatedUserData.Username}`;
    }
    if (Password) {
      updateMessage += ` Password: ${updatedUserData.Password}`;
    }

    // Menambahkan entri riwayat
    await tambahRiwayat('Users', userId, updateMessage);

    res.status(200).send(updateMessage);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengupdate pengguna');
  }
});

// Mnghapus pengguna berdasarkan ID
app.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const userRef = db.collection('Users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send('Pengguna tidak ditemukan');
    }

    const deletedUserData = userDoc.data();

    await userRef.delete();

    // Keterangan username yang dihapus
    const deleteMessage = `Pengguna dengan Username ${deletedUserData.Username} berhasil dihapus`;

    // Menambahkan entri riwayat
    await tambahRiwayat('Users', userId, deleteMessage);

    res.status(200).send(deleteMessage);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat menghapus pengguna');
  }
});

// Menampilkan semua user
app.get('/users', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('Users').get();
    const usersData = [];

    usersSnapshot.forEach(doc => {
      usersData.push(doc.data());
    });

    res.status(200).json(usersData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data pengguna');
  }
});

// Mengupdate nama pengguna berdasarkan ID
app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const userDoc = await db.collection('Users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).send('Pengguna tidak ditemukan');
    }

    const userData = userDoc.data();
    const username = userData.Username;

    res.status(200).json({ id: userId, Username: username });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saat mengambil data pengguna');
  }
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
