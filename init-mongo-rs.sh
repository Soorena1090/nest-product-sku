cat << 'EOF' > init-mongo-rs.sh
#!/bin/bash
# صبر کردن برای آماده‌شدن سرویس
echo "Waiting for MongoDB to fully start..."
sleep 10

echo "Initializing replica set 'rs0'..."
mongosh --port 27017 --eval "
  try {
    rs.initiate({
      _id: \"rs0\",
      members: [
        { _id: 0, host: \"mongo:27017\" }
      ]
    });
    print('Replica set initialized successfully.');
  } catch(e) {
    if (e.code !== 96) { // Code 96 = Already initialized, which is OK
        print('Error during replica set initiation: ' + e);
    }
  }
"
EOF