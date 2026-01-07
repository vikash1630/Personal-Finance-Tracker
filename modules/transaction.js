const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be greater than zero"]
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 2
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true } // adds createdAt & updatedAt
);

module.exports = mongoose.model("Transaction", TransactionSchema);
