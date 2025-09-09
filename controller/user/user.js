const { query } = require("../../utils/query");
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const { fileDir } = require("../../utils/file_handler.cjs")

// const updatePassword = async (req, res) => {
//   const { newPassword, confPassword } = req.body;
//   const userUuid = req.params.uuid; // UUID from the URL parameter

//   try {
//     // Validate the new and confirmed password
//     if (!newPassword || !confPassword) {
//       return res.status(400).json({ error: "Both new password and confirmation password are required." });
//     }

//     if (newPassword !== confPassword) {
//       return res.status(400).json({ error: "Passwords do not match." });
//     }

//     // Optional: Role-based logic can be added here (if needed)
//     // For example: Only admins can update passwords for others (this is optional)
//     // const loggedInUserRole = req.user.role;
//     // if (loggedInUserRole !== "admin") {
//     //   return res.status(403).json({ error: "Only admins can update passwords for other users." });
//     // }

//     // Hash the new password (if you plan to use bcrypt)
//     // const hashedPassword = await bcrypt.hash(newPassword, 10);

//     // Update the password for the user identified by the UUID in the URL
//     await query(`UPDATE users SET password = ?, updated_at = ? WHERE uuid = ?`, [newPassword, new Date(), userUuid]);

//     return res.status(200).json({ message: "Password updated successfully." });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: error.message });
//   }
// };

/**
 * Update user profile information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProfile = async (req, res) => {
  const { username, email, phone, bio } = req.body
  const userUuid = req.user.uuid

  try {
    // Validate required fields
    if (!username) {
      return res.status(400).json({ error: "Username is required." })
    }

    // Check if username already exists (if changed)
    const currentUser = await query(`SELECT * FROM users WHERE uuid = ?`, [userUuid])

    if (currentUser.length === 0) {
      return res.status(404).json({ error: "User not found." })
    }

    if (username !== currentUser[0].username) {
      const existingUser = await query(`SELECT * FROM users WHERE username = ? AND uuid != ?`, [username, userUuid])
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "Username already exists." })
      }
    }

    // Prepare update data
    const updateData = {
      username,
      email: email || null,
      phone: phone || null,
      bio: bio || null,
      updated_At: new Date(),
    }

    // Handle file upload if present
    if (req.file) {
      // Get the current profile photo to delete it later if it exists
      const currentPhoto = currentUser[0]?.photo

      // Set the new profile photo path - store only the filename
      const filename = path.basename(req.file.path)
      updateData.photo = filename

      // Delete the old profile photo if it exists and is different
      if (currentPhoto && currentPhoto !== filename) {
        const oldFilePath = path.join(fileDir(), currentPhoto)
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath)
        }
      }
    }

    // Update user profile in database
    const updateFields = Object.keys(updateData)
      .map((key) => `${key} = ?`)
      .join(", ")

    const updateValues = Object.values(updateData)
    updateValues.push(userUuid) // Add UUID for WHERE clause

    await query(`UPDATE users SET ${updateFields} WHERE uuid = ?`, updateValues)

    // Get updated user data (excluding password)
    const updatedUser = await query(
      `SELECT uuid, username, email, phone, bio, role, photo, created_At, updated_At 
       FROM users WHERE uuid = ?`,
      [userUuid],
    )

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: "User not found after update." })
    }

    // Format profile photo URL if it exists
    if (updatedUser[0].photo) {
      // Create a proper URL for the frontend
      updatedUser[0].photo_url = `/api/files/${updatedUser[0].photo}`
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser[0],
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    return res.status(500).json({ error: error.message })
  }
}

/**
 * Get user profile information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfile = async (req, res) => {
  const userUuid = req.user.uuid

  try {
    // Get user data (excluding password)
    const user = await query( 
      `SELECT uuid, username, email, phone, bio, role, photo, created_At, updated_At 
       FROM users WHERE uuid = ?`,
      [userUuid],
    )

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found." })
    }

    // Format profile photo URL if it exists
    if (user[0].photo) {
      // Create a proper URL for the frontend
      user[0].photo_url = `/files/${user[0].photo}`
    }

    return res.status(200).json({
      success: true,
      user: user[0],
    })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return res.status(500).json({ error: error.message })
  }
}

/**
 * Update user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body
  const userUuid = req.user.uuid // Get UUID from authenticated user

  try {
    // Validate the new and confirmed password
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: "Current password, new password, and confirmation password are required.",
      })
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New passwords do not match." })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." })
    }

    // Get the current user's password
    const user = await query(`SELECT password FROM users WHERE uuid = ?`, [userUuid])

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found." })
    }

    // Verify current password using bcrypt
    const isPasswordValid = await bcrypt.compare(currentPassword, user[0].password)
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect." })
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update the password
    await query(`UPDATE users SET password = ?, updated_At = ? WHERE uuid = ?`, 
      [hashedNewPassword, new Date(), userUuid]
    )

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    })
  } catch (error) {
    console.error("Error updating password:", error)
    return res.status(500).json({ error: error.message })
  }
}

/**
 * Delete a user (soft delete)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const DeleteUser = async (req, res) => {
  const { uuid } = req.params
  console.log(uuid)

  try {
    if (!uuid) {
      return res.status(400).json({ error: "UUID is required" })
    }

    // Check if user exists
    const cekUser = await query(`SELECT * FROM users WHERE uuid = ?`, [uuid])

    if (cekUser.length === 0) {
      return res.status(400).json({ error: "User not found" })
    }

    // Soft delete by setting is_deleted to 1
    await query(`UPDATE users SET is_deleted = 1, updated_At = ? WHERE uuid = ?`, [new Date(), uuid])

    return res.status(200).json({ success: true, message: "User has been deleted" })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

/**
 * Serve a file from the files directory
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const serveFile = async (req, res) => {
  const filename = req.params.filename
  const filePath = path.join(fileDir(), filename)

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" })
    }

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase()
    let contentType = "application/octet-stream" // Default content type

    switch (ext) {
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg"
        break
      case ".png":
        contentType = "image/png"
        break
      case ".gif":
        contentType = "image/gif"
        break
      case ".pdf":
        contentType = "application/pdf"
        break
      // Add more content types as needed
    }

    // Set content type and send file
    res.setHeader("Content-Type", contentType)
    fs.createReadStream(filePath).pipe(res)
  } catch (error) {
    console.error("Error serving file:", error)
    return res.status(500).json({ error: error.message })
  }
}

/**
 * Request password reset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const requestPasswordReset = async (req, res) => {
  const { email } = req.body

  try {
    if (!email) {
      return res.status(400).json({ error: "Email is required." })
    }

    // Check if user exists
    const user = await query(`SELECT * FROM users WHERE email = ?`, [email])

    if (user.length === 0) {
      // For security reasons, don't reveal that the email doesn't exist
      return res.status(200).json({
        success: true,
        message: "If your email exists in our system, you will receive password reset instructions.",
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    // Save token to database
    await query(`UPDATE users SET reset_token = ?, reset_token_expiry = ?, updated_at = ? WHERE uuid = ?`, [
      resetToken,
      resetTokenExpiry,
      new Date(),
      user[0].uuid,
    ])

    // Send email with reset link
    // Note: In a real application, configure a proper email service
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`

    // Example using nodemailer (you would configure this with your SMTP settings)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.example.com",
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "user@example.com",
        pass: process.env.SMTP_PASS || "password",
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@example.com",
      to: email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Please click the following link to reset your password: ${resetUrl}`,
      html: `
        <p>You requested a password reset.</p>
        <p>Please click the following link to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this reset, please ignore this email.</p>
      `,
    })

    return res.status(200).json({
      success: true,
      message: "If your email exists in our system, you will receive password reset instructions.",
    })
  } catch (error) {
    console.error("Error requesting password reset:", error)
    return res.status(500).json({ error: error.message })
  }
}

/**
 * Reset password with token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resetPassword = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body

  try {
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: "Reset token, new password, and confirmation password are required.",
      })
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." })
    }

    // Find user with valid token
    const user = await query(`SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?`, [
      token,
      new Date(),
    ])

    if (user.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset token." })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password and clear reset token
    await query(
      `UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL, updated_at = ? WHERE uuid = ?`,
      [hashedPassword, new Date(), user[0].uuid],
    )

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully.",
    })
  } catch (error) {
    console.error("Error resetting password:", error)
    return res.status(500).json({ error: error.message })
  }
}

module.exports = {
 updateProfile,
  getProfile,
  updatePassword,
  DeleteUser,
  serveFile,
  requestPasswordReset,
  resetPassword
};
