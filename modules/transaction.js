const mongoose = require('mongoose');

const TransactionSchema = mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  transaction: {
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);